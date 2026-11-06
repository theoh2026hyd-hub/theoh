import nodemailer from "nodemailer";
import { getSiteOrigin } from "./appOrigin";

/** Primary inbox for new-order alerts */
export const NEW_ORDER_ADMIN_EMAIL = "theoh2026hyd@gmail.com";

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInr(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "₹0.00";
  return `₹${n.toFixed(2)}`;
}

function formatAddonsLine(addons) {
  if (!Array.isArray(addons) || addons.length === 0) return "";
  return addons
    .map((a) => {
      const name = a?.name || a?.label || "Addon";
      const qty = Number(a?.quantity || a?.qty || 1);
      const price = Number(a?.price || 0);
      const qtyPart = qty > 1 ? ` ×${qty}` : "";
      const pricePart = price > 0 ? ` (${formatInr(price * qty)})` : "";
      return `${name}${qtyPart}${pricePart}`;
    })
    .join(", ");
}

export async function sendAdminOtpEmail(to, otp) {
  console.log(`\n======================================================\n🔐 [ADMIN OTP] Code for ${to}: ${otp}\n======================================================\n`);
  try {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
      from: `"THE OH ! Admin" <${from}>`,
      to,
      subject: "Your Admin Console OTP — THE OH !",
      text: `Your one-time admin access code is: ${otp}\n\nThis code expires in 50 seconds. If you did not request this, you can ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #011e02; margin-bottom: 8px;">THE OH ! Admin Console</h2>
          <p style="color: #444; line-height: 1.5;">Use this one-time code to unlock the admin panel:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #011e02; margin: 24px 0;">${otp}</p>
          <p style="color: #888; font-size: 13px;">This code expires in 50 seconds.</p>
        </div>
      `
    });
  } catch (err) {
    console.error("⚠️ [Nodemailer SMTP Auth Warning]:", err.message);
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[DEV MODE] SMTP dispatch failed. You can use the OTP printed above in the terminal: ${otp}`);
      return { success: false, devFallback: true, error: err.message };
    }
    throw err;
  }
}

export async function sendSignupOtpEmail(to, otp) {
  console.log(`\n======================================================\n🔐 [SIGNUP OTP] Code for ${to}: ${otp}\n======================================================\n`);
  try {
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
  } catch (err) {
    console.error("⚠️ [Nodemailer SMTP Auth Warning]:", err.message);
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[DEV MODE] SMTP dispatch failed. You can use the OTP printed above in the terminal: ${otp}`);
      return { success: false, devFallback: true, error: err.message };
    }
    throw err;
  }
}

export async function sendPasswordResetOtpEmail(to, otp) {
  console.log(`\n======================================================\n🔐 [PASSWORD RESET OTP] Code for ${to}: ${otp}\n======================================================\n`);
  try {
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
  } catch (err) {
    console.error("⚠️ [Nodemailer SMTP Auth Warning]:", err.message);
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[DEV MODE] SMTP dispatch failed. You can use the OTP printed above in the terminal: ${otp}`);
      return { success: false, devFallback: true, error: err.message };
    }
    throw err;
  }
}

/**
 * Notify the store admin inbox when a new paid order is placed.
 * @param {object} order — order fields used in the email body
 * @param {array} items — cart line items
 */
export async function sendNewOrderAdminEmail(order, items = []) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const to = process.env.NEW_ORDER_ADMIN_EMAIL || NEW_ORDER_ADMIN_EMAIL;

  const displayId = order.displayOrderId || order.orderNumber || order.id || "—";
  const siteOrigin = getSiteOrigin();
  const detailsUrl = siteOrigin
    ? `${siteOrigin}/admin?order=${encodeURIComponent(order.id)}`
    : `/admin?order=${encodeURIComponent(order.id || "")}`;

  const itemRows = (Array.isArray(items) ? items : [])
    .map((item) => {
      const name = item.sizeLabel ? `${item.name} (${item.sizeLabel})` : item.name;
      const qty = Number(item.quantity || 1);
      const unit = Number(item.price || 0);
      const lineTotal = unit * qty;
      const addons = formatAddonsLine(item.selectedAddons || item.selected_addons);
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top;">
            <div style="font-weight:600;color:#1e1e1e;">${escapeHtml(name)}</div>
            ${addons ? `<div style="color:#6b6b6b;font-size:12px;margin-top:4px;">+ ${escapeHtml(addons)}</div>` : ""}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;color:#444;">${qty}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;color:#444;">${escapeHtml(formatInr(unit))}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;color:#011e02;">${escapeHtml(formatInr(lineTotal))}</td>
        </tr>`;
    })
    .join("");

  const customerName = order.customer_name || order.customerName || "—";
  const customerPhone = order.customer_phone || order.customerPhone || "—";
  const receiverName = order.receiver_name || order.receiverName || "";
  const receiverPhone = order.receiver_phone || order.receiverPhone || "";
  const address = order.delivery_address || order.deliveryAddress || "—";
  const landmark = order.landmark || "";
  const pincode = order.pincode || "";
  const instructions = order.special_instructions || order.specialInstructions || "";
  const subtotal = order.subtotal ?? 0;
  const coinDiscount = order.coin_discount ?? order.coinDiscount ?? 0;
  const promoDiscount = order.promo_discount ?? order.promoDiscount ?? 0;
  const tax = order.tax ?? 0;
  const grandTotal = order.grand_total ?? order.grandTotal ?? 0;

  const textLines = [
    `New order ${displayId}`,
    `Customer: ${customerName} (${customerPhone})`,
    receiverName ? `Receiver: ${receiverName} (${receiverPhone})` : null,
    `Address: ${address}`,
    landmark ? `Landmark: ${landmark}` : null,
    pincode ? `Pincode: ${pincode}` : null,
    instructions ? `Notes: ${instructions}` : null,
    "",
    ...(Array.isArray(items) ? items : []).map((item) => {
      const name = item.sizeLabel ? `${item.name} (${item.sizeLabel})` : item.name;
      const qty = Number(item.quantity || 1);
      const unit = Number(item.price || 0);
      const addons = formatAddonsLine(item.selectedAddons || item.selected_addons);
      return `- ${name} x${qty} @ ${formatInr(unit)}${addons ? ` (+ ${addons})` : ""} = ${formatInr(unit * qty)}`;
    }),
    "",
    `Subtotal: ${formatInr(subtotal)}`,
    Number(coinDiscount) > 0 ? `Coin discount: -${formatInr(coinDiscount)}` : null,
    Number(promoDiscount) > 0 ? `Promo discount: -${formatInr(promoDiscount)}` : null,
    Number(tax) > 0 ? `Tax: ${formatInr(tax)}` : null,
    `Grand total: ${formatInr(grandTotal)}`,
    "",
    `View details: ${detailsUrl}`,
  ].filter(Boolean);

  await transporter.sendMail({
    from: `"THE OH ! Orders" <${from}>`,
    to,
    subject: `New Order ${displayId} — ${customerName} — ${formatInr(grandTotal)}`,
    text: textLines.join("\n"),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f8f6f2;color:#1e1e1e;">
        <div style="background:#011e02;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;font-size:20px;letter-spacing:0.02em;">THE OH ! — New Order</h1>
          <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">Order <strong>${escapeHtml(displayId)}</strong></p>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e8e5df;border-top:none;border-radius:0 0 12px 12px;">
          <h2 style="margin:0 0 12px;font-size:15px;color:#011e02;text-transform:uppercase;letter-spacing:0.06em;">Customer</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
            <tr><td style="padding:4px 0;color:#6b6b6b;width:120px;">Name</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(customerName)}</td></tr>
            <tr><td style="padding:4px 0;color:#6b6b6b;">Phone</td><td style="padding:4px 0;">${escapeHtml(customerPhone)}</td></tr>
            ${receiverName ? `<tr><td style="padding:4px 0;color:#6b6b6b;">Receiver</td><td style="padding:4px 0;">${escapeHtml(receiverName)} · ${escapeHtml(receiverPhone)}</td></tr>` : ""}
            <tr><td style="padding:4px 0;color:#6b6b6b;vertical-align:top;">Address</td><td style="padding:4px 0;">${escapeHtml(address)}</td></tr>
            ${landmark ? `<tr><td style="padding:4px 0;color:#6b6b6b;">Landmark</td><td style="padding:4px 0;">${escapeHtml(landmark)}</td></tr>` : ""}
            ${pincode ? `<tr><td style="padding:4px 0;color:#6b6b6b;">Pincode</td><td style="padding:4px 0;">${escapeHtml(pincode)}</td></tr>` : ""}
            ${instructions ? `<tr><td style="padding:4px 0;color:#6b6b6b;vertical-align:top;">Notes</td><td style="padding:4px 0;white-space:pre-wrap;">${escapeHtml(instructions)}</td></tr>` : ""}
          </table>

          <h2 style="margin:0 0 12px;font-size:15px;color:#011e02;text-transform:uppercase;letter-spacing:0.06em;">Items</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
            <thead>
              <tr style="background:#f3f1ec;text-align:left;">
                <th style="padding:10px 12px;">Item</th>
                <th style="padding:10px 12px;text-align:center;">Qty</th>
                <th style="padding:10px 12px;text-align:right;">Price</th>
                <th style="padding:10px 12px;text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows || `<tr><td colspan="4" style="padding:12px;color:#888;">No items</td></tr>`}
            </tbody>
          </table>

          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
            <tr><td style="padding:4px 0;color:#6b6b6b;">Subtotal</td><td style="padding:4px 0;text-align:right;">${escapeHtml(formatInr(subtotal))}</td></tr>
            ${Number(coinDiscount) > 0 ? `<tr><td style="padding:4px 0;color:#6b6b6b;">Coin discount</td><td style="padding:4px 0;text-align:right;color:#c62828;">-${escapeHtml(formatInr(coinDiscount))}</td></tr>` : ""}
            ${Number(promoDiscount) > 0 ? `<tr><td style="padding:4px 0;color:#6b6b6b;">Promo discount</td><td style="padding:4px 0;text-align:right;color:#c62828;">-${escapeHtml(formatInr(promoDiscount))}</td></tr>` : ""}
            ${Number(tax) > 0 ? `<tr><td style="padding:4px 0;color:#6b6b6b;">Tax</td><td style="padding:4px 0;text-align:right;">${escapeHtml(formatInr(tax))}</td></tr>` : ""}
            <tr>
              <td style="padding:10px 0 0;font-weight:700;font-size:16px;border-top:1px solid #e8e5df;">Grand total</td>
              <td style="padding:10px 0 0;text-align:right;font-weight:700;font-size:16px;color:#011e02;border-top:1px solid #e8e5df;">${escapeHtml(formatInr(grandTotal))}</td>
            </tr>
          </table>

          <a href="${escapeHtml(detailsUrl)}" style="display:inline-block;background:#011e02;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">View Details</a>
        </div>
      </div>
    `,
  });
}
