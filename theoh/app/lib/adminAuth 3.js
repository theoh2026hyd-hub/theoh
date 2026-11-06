import crypto from "crypto";
import { cookies } from "next/headers";

export const ADMIN_EMAILS = [
  "ugadiharshavardhan@gmail.com",
  "videshthota889@gmail.com",
  "theoh2026hyd@gmail.com"
];

/** Primary admin inbox (legacy export) */
export const ADMIN_EMAIL = ADMIN_EMAILS[0];
const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_COOKIE = "theoh_admin_session";
const OTP_PENDING_COOKIE = "theoh_admin_otp_pending";

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET environment variable is required in production.");
  }
  return secret || "theoh-dev-admin-secret-change-me";
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAuthorizedEmail(email) {
  return ADMIN_EMAILS.includes(normalizeEmail(email));
}

export function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp) {
  return crypto.createHmac("sha256", getSecret()).update(String(otp).trim()).digest("hex");
}

function signPayload(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function parseSignedToken(token) {
  if (!token || !token.includes(".")) return null;

  const [encodedPayload, signature] = token.split(".");
  const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");

  if (signPayload(payload) !== signature) return null;

  return payload;
}

function parseOtpPendingToken(token) {
  const payload = parseSignedToken(token);
  if (!payload) return null;

  const [email, expiresAtRaw, otpHash] = payload.split(":");
  const expiresAt = parseInt(expiresAtRaw, 10);

  if (!email || !expiresAt || !otpHash) return null;

  return { email, expiresAt, otpHash };
}

/** Persist OTP in a signed httpOnly cookie so verification works across serverless instances. */
export async function storeOtp(email, otp) {
  const normalized = normalizeEmail(email);
  const expiresAt = Date.now() + OTP_TTL_MS;
  const otpHash = hashOtp(otp);
  const payload = `${normalized}:${expiresAt}:${otpHash}`;
  const token = `${Buffer.from(payload, "utf8").toString("base64url")}.${signPayload(payload)}`;

  const cookieStore = await cookies();
  cookieStore.set(OTP_PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(OTP_TTL_MS / 1000)
  });
}

export async function clearOtpPending() {
  const cookieStore = await cookies();
  cookieStore.delete(OTP_PENDING_COOKIE);
}

export async function verifyOtp(email, otp) {
  const normalized = normalizeEmail(email);
  const cookieStore = await cookies();
  const token = cookieStore.get(OTP_PENDING_COOKIE)?.value;
  const record = parseOtpPendingToken(token);

  if (!record) return false;
  if (record.email !== normalized) return false;

  if (Date.now() > record.expiresAt) {
    await clearOtpPending();
    return false;
  }

  const submittedHash = hashOtp(otp);
  const storedHash = Buffer.from(record.otpHash, "hex");
  const candidateHash = Buffer.from(submittedHash, "hex");

  if (storedHash.length !== candidateHash.length) {
    return false;
  }

  const isValid = crypto.timingSafeEqual(storedHash, candidateHash);
  if (isValid) {
    await clearOtpPending();
  }

  return isValid;
}

export function createSessionToken(email) {
  const normalized = normalizeEmail(email);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${normalized}:${expiresAt}`;
  const signature = signPayload(payload);
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

export function parseSessionToken(token) {
  const payload = parseSignedToken(token);
  if (!payload) return null;

  const [email, expiresAtRaw] = payload.split(":");
  const expiresAt = parseInt(expiresAtRaw, 10);

  if (!email || !expiresAt || Date.now() > expiresAt) return null;
  if (!isAuthorizedEmail(email)) return null;

  return { email, expiresAt };
}

export async function setAdminSession(email) {
  const token = createSessionToken(email);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000)
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(OTP_PENDING_COOKIE);
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return parseSessionToken(token);
}

export async function isAdminAuthenticated() {
  const session = await getAdminSession();
  return Boolean(session);
}

export { isAuthorizedEmail, normalizeEmail };
