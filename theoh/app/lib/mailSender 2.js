import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");

  if (!host || !user || !pass) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in your environment."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

export async function sendAdminOtpEmail(to, otp) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"THE OH ! Admin" <${from}>`,
    to,
    subject: "Your Admin Console OTP — THE OH !",
    text: `Your one-time admin access code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #011e02; margin-bottom: 8px;">THE OH ! Admin Console</h2>
        <p style="color: #444; line-height: 1.5;">Use this one-time code to unlock the admin panel:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #011e02; margin: 24px 0;">${otp}</p>
        <p style="color: #888; font-size: 13px;">This code expires in 10 minutes.</p>
      </div>
    `
  });
}

export async function sendSignupOtpEmail(to, otp) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"THE OH !" <${from}>`,
    to,
    subject: "Verify Your Email — THE OH !",
    text: `Your email verification code is: ${otp}\n\nEnter this code to complete your sign up. This code expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #011e02; margin-bottom: 8px;">THE OH ! Email Verification</h2>
        <p style="color: #444; line-height: 1.5;">Enter this code to verify your email and complete sign up:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #011e02; margin: 24px 0;">${otp}</p>
        <p style="color: #888; font-size: 13px;">This code expires in 10 minutes.</p>
      </div>
    `
  });
}

export async function sendPasswordResetOtpEmail(to, otp) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"THE OH !" <${from}>`,
    to,
    subject: "Your Password Reset Code — THE OH !",
    text: `Your password reset code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request a password reset, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #011e02; margin-bottom: 8px;">THE OH ! Password Reset</h2>
        <p style="color: #444; line-height: 1.5;">Use this code to reset your account password:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #011e02; margin: 24px 0;">${otp}</p>
        <p style="color: #888; font-size: 13px;">This code expires in 10 minutes.</p>
      </div>
    `
  });
}
