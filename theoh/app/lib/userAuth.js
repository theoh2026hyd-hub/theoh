import crypto from "crypto";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET or ADMIN_SESSION_SECRET environment variable is required in production.");
  }
  return secret || "theoh-dev-admin-secret-change-me";
}

export function normalizeUserEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getOtpStore() {
  if (!globalThis.__theohUserOtpStore) {
    globalThis.__theohUserOtpStore = new Map();
  }
  return globalThis.__theohUserOtpStore;
}

function getResetTokenStore() {
  if (!globalThis.__theohUserResetTokenStore) {
    globalThis.__theohUserResetTokenStore = new Map();
  }
  return globalThis.__theohUserResetTokenStore;
}

export function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getSignupOtpStore() {
  if (!globalThis.__theohSignupOtpStore) {
    globalThis.__theohSignupOtpStore = new Map();
  }
  return globalThis.__theohSignupOtpStore;
}

export function storeSignupOtp(email, otp, { fullName, password }) {
  const normalized = normalizeUserEmail(email);
  getSignupOtpStore().set(normalized, {
    otp: String(otp).trim(),
    expiresAt: Date.now() + OTP_TTL_MS,
    fullName: String(fullName || "").trim(),
    password: String(password || ""),
  });
}

export function verifySignupOtp(email, otp) {
  const normalized = normalizeUserEmail(email);
  const cleanOtp = String(otp || "").replace(/\D/g, "").trim();
  const record = getSignupOtpStore().get(normalized);

  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    getSignupOtpStore().delete(normalized);
    return null;
  }

  if (record.otp !== cleanOtp) {
    return null;
  }

  getSignupOtpStore().delete(normalized);
  return {
    fullName: record.fullName,
    password: record.password,
  };
}

export function clearSignupOtp(email) {
  getSignupOtpStore().delete(normalizeUserEmail(email));
}

export function storePasswordResetOtp(email, otp) {
  const normalized = normalizeUserEmail(email);
  getOtpStore().set(normalized, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
  });
}

export function verifyPasswordResetOtp(email, otp) {
  const normalized = normalizeUserEmail(email);
  const cleanOtp = String(otp || "").replace(/\D/g, "").trim();
  const record = getOtpStore().get(normalized);

  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    getOtpStore().delete(normalized);
    return false;
  }

  const isValid = String(record.otp).replace(/\D/g, "").trim() === cleanOtp;
  if (isValid) {
    getOtpStore().delete(normalized);
  }
  return isValid;
}

function signPayload(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createPasswordResetToken(email) {
  const normalized = normalizeUserEmail(email);
  const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${normalized}:${expiresAt}:${nonce}`;
  const signature = signPayload(payload);
  const token = `${Buffer.from(payload).toString("base64url")}.${signature}`;

  getResetTokenStore().set(normalized, {
    token,
    expiresAt,
  });

  return token;
}

export function verifyPasswordResetToken(email, token) {
  const normalized = normalizeUserEmail(email);
  const record = getResetTokenStore().get(normalized);

  if (!record || record.token !== token) return false;
  if (Date.now() > record.expiresAt) {
    getResetTokenStore().delete(normalized);
    return false;
  }

  return true;
}

export function clearPasswordResetToken(email) {
  getResetTokenStore().delete(normalizeUserEmail(email));
}
