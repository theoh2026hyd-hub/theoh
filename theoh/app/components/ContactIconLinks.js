"use client";

import { Mail, Phone } from "lucide-react";
import { CONTACT_EMAIL, CONTACT_INSTAGRAM_URL, getGmailComposeHref, getPhoneDialHref } from "../lib/contactInfo";

function InstagramIcon({ size = 18 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function ContactPhoneIconLink({ phone, className = "contact-icon-link", size = 18 }) {
  return (
    <a
      href={getPhoneDialHref(phone)}
      className={className}
      aria-label="Call THE OH !"
    >
      <Phone size={size} aria-hidden="true" />
    </a>
  );
}

export function ContactInstagramIconLink({ className = "contact-icon-link", size = 18 }) {
  return (
    <a
      href={CONTACT_INSTAGRAM_URL}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Follow THE OH ! on Instagram"
    >
      <InstagramIcon size={size} />
    </a>
  );
}

export function ContactEmailIconLink({
  email = CONTACT_EMAIL,
  className = "contact-icon-link",
  size = 18
}) {
  const targetEmail = String(email || CONTACT_EMAIL).trim();
  return (
    <a
      href={getGmailComposeHref(targetEmail)}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Email THE OH ! at ${targetEmail}`}
      title={targetEmail}
    >
      <Mail size={size} aria-hidden="true" />
    </a>
  );
}
