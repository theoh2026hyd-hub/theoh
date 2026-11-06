"use client";

import { useEffect } from "react";

/**
 * GlobalError — Root-level error boundary that catches errors in the root layout itself.
 * Must include its own <html> and <body> tags since root layout has crashed.
 * Uses inline styles since CSS may not be available.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("Global application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F8F6F2",
          fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: "#1E1E1E",
        }}
      >
        <div
          style={{
            textAlign: "center",
            padding: "40px 24px",
            maxWidth: "480px",
          }}
        >
          {/* Inline SVG — brand-colored warning icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 240 200"
            fill="none"
            style={{ width: "180px", maxWidth: "60vw", height: "auto", marginBottom: "24px" }}
            role="img"
            aria-label="Error illustration"
          >
            <circle cx="120" cy="100" r="80" fill="#F8F6F2" />
            <rect x="85" y="60" width="70" height="80" rx="8" stroke="#011E02" strokeWidth="3" fill="none" />
            <line x1="100" y1="82" x2="140" y2="82" stroke="#E8E5DF" strokeWidth="2" />
            <line x1="100" y1="100" x2="140" y2="100" stroke="#E8E5DF" strokeWidth="2" />
            <line x1="100" y1="118" x2="140" y2="118" stroke="#E8E5DF" strokeWidth="2" />
            <circle cx="132" cy="74" r="3" fill="#C62828" />
            <path d="M120 42L130 58H110Z" stroke="#0a4f22" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
            <line x1="120" y1="48" x2="120" y2="53" stroke="#0a4f22" strokeWidth="2" strokeLinecap="round" />
            <circle cx="120" cy="56" r="1.2" fill="#0a4f22" />
          </svg>

          <h1
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
              fontWeight: 700,
              color: "#011E02",
              marginBottom: "12px",
              lineHeight: 1.2,
            }}
          >
            Something Went Wrong
          </h1>

          <p
            style={{
              fontSize: "clamp(0.875rem, 1.5vw, 1.05rem)",
              color: "#6B6B6B",
              lineHeight: 1.6,
              marginBottom: "32px",
            }}
          >
            An unexpected error occurred. Please try again.
          </p>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => reset()}
              style={{
                fontFamily: "inherit",
                fontWeight: 600,
                padding: "14px 32px",
                background: "#0F4D2F",
                color: "#F8F6F2",
                borderRadius: "9999px",
                border: "1px solid #0F4D2F",
                fontSize: "0.85rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
              }}
            >
              Try Again
            </button>

            <button
              onClick={() => { window.location.href = "/"; }}
              style={{
                fontFamily: "inherit",
                fontWeight: 600,
                padding: "14px 32px",
                background: "transparent",
                color: "#011E02",
                borderRadius: "9999px",
                border: "1px solid #011E02",
                fontSize: "0.85rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
              }}
            >
              Go Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
