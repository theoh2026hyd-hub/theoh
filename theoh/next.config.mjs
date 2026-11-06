import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(projectRoot, "..");

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com https://cdn.razorpay.com https://*.razorpay.com https://unpkg.com https://browser.sentry-cdn.com https://api.sardine.ai https://*.sardine.ai https://*.px-cloud.net https://*.pxchk.net https://*.px-cdn.net https://js.stripe.com https://*.stripe.com;
  style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com https://*.razorpay.com https://cdn.razorpay.com https://*.stripe.com;
  img-src 'self' blob: data: https://res.cloudinary.com https://*.supabase.co https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://maps.gstatic.com https://maps.googleapis.com https://unpkg.com https://*.razorpay.com https://cdn.razorpay.com https://*.stripe.com https://*.px-cloud.net https://*.pxchk.net https://*.px-cdn.net;
  font-src 'self' data: https://fonts.gstatic.com https://*.razorpay.com https://*.stripe.com;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://lumberjack.razorpay.com https://lumberjack-metrics.razorpay.com https://*.razorpay.com wss://*.razorpay.com https://*.sentry.io https://browser.sentry-cdn.com https://api.sardine.ai https://*.sardine.ai https://*.px-cloud.net https://*.pxchk.net https://*.px-cdn.net https://r.stripe.com https://*.stripe.com https://m.stripe.network https://q.stripe.com https://nominatim.openstreetmap.org https://router.project-osrm.org https://valhalla1.openstreetmap.de https://routes.googleapis.com https://maps.googleapis.com https://unpkg.com;
  frame-src 'self' https://checkout.razorpay.com https://api.razorpay.com https://*.razorpay.com https://*.stripe.com https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://www.google.com https://maps.google.com;
  media-src 'self' https://res.cloudinary.com https://cdn.pixabay.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self' https://*.razorpay.com https://api.razorpay.com https://*.stripe.com;
  frame-ancestors 'none';
  block-all-mixed-content;
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim();


/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**"
      }
    ]
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=*, otp-credentials=*, publickey-credentials-get=*, clipboard-read=*, clipboard-write=*, usb=(), bluetooth=(), accelerometer=*, gyroscope=*, magnetometer=*",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Access-Control-Expose-Headers",
            value: "x-rtb-fingerprint-id, request-id, *",
          }
        ],
      },
    ];
  }
};

export default nextConfig;
