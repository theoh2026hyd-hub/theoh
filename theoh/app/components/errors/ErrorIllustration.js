"use client";

/**
 * ErrorIllustration — Inline SVG illustrations for error/empty/status states.
 * Uses THE OH ! brand colors (#011E02, #0a4f22, #F8F6F2).
 * No external image dependencies.
 */

const BRAND_GREEN = "#011E02";
const BRAND_EMERALD = "#0a4f22";
const BRAND_IVORY = "#F8F6F2";
const BRAND_LIGHT = "#E8E5DF";
const BRAND_MUTED = "#6B6B6B";

function BaseSvg({ children, viewBox = "0 0 240 200", className = "", ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill="none"
      className={`error-illustration ${className}`}
      role="img"
      {...props}
    >
      {children}
    </svg>
  );
}

function NotFoundIllustration() {
  return (
    <BaseSvg aria-label="Page not found illustration" viewBox="0 0 240 220">
      {/* Soft background glow */}
      <ellipse cx="120" cy="118" rx="90" ry="85" fill={BRAND_IVORY} />

      {/* Folded document page */}
      <path
        d="M80 50h60l24 24v96H80V50z"
        fill="#FFFFFF"
        stroke={BRAND_GREEN}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Document fold triangle */}
      <path
        d="M140 50v24h24"
        fill={BRAND_IVORY}
        stroke={BRAND_GREEN}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Document lines (content) */}
      <line x1="96" y1="90" x2="148" y2="90" stroke={BRAND_LIGHT} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="96" y1="104" x2="140" y2="104" stroke={BRAND_LIGHT} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="96" y1="118" x2="132" y2="118" stroke={BRAND_LIGHT} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="96" y1="132" x2="144" y2="132" stroke={BRAND_LIGHT} strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
      <line x1="96" y1="146" x2="126" y2="146" stroke={BRAND_LIGHT} strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />

      {/* Torn/ripped bottom-right corner */}
      <path
        d="M164 148l-8 6 5 8-10 2 3 8H130"
        stroke={BRAND_GREEN}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Small leaf sprouting from torn corner — organic feel */}
      <path
        d="M166 140c6-10 18-12 22-4-8-2-14 2-18 10"
        fill={BRAND_EMERALD}
        opacity="0.7"
      />
      <path
        d="M170 145c4-12 16-16 22-8-8 0-14 4-18 14"
        fill={BRAND_GREEN}
        opacity="0.5"
      />
      <line x1="168" y1="148" x2="166" y2="140" stroke={BRAND_EMERALD} strokeWidth="1.5" strokeLinecap="round" />

      {/* Floating question mark — lost page concept */}
      <circle cx="58" cy="72" r="18" fill="none" stroke={BRAND_EMERALD} strokeWidth="2" opacity="0.3" />
      <text x="52" y="80" fontFamily="Poppins, sans-serif" fontSize="20" fontWeight="600" fill={BRAND_EMERALD} opacity="0.4">?</text>

      {/* Scattered decorative dots */}
      <circle cx="42" cy="160" r="3" fill={BRAND_LIGHT} />
      <circle cx="195" cy="80" r="3.5" fill={BRAND_LIGHT} />
      <circle cx="188" cy="168" r="2.5" fill={BRAND_LIGHT} />
      <circle cx="55" cy="44" r="2" fill={BRAND_LIGHT} />

      {/* Small sparkle/star accents */}
      <path d="M198 108l3-6 3 6-6 3 6 3-3 6-3-6-6-3z" fill={BRAND_LIGHT} opacity="0.6" />
      <path d="M46 120l2-4 2 4-4 2 4 2-2 4-2-4-4-2z" fill={BRAND_LIGHT} opacity="0.5" />
    </BaseSvg>
  );
}

function ServerErrorIllustration() {
  return (
    <BaseSvg aria-label="Server error illustration">
      <circle cx="120" cy="100" r="80" fill={BRAND_IVORY} />
      {/* Server box */}
      <rect x="85" y="60" width="70" height="80" rx="8" stroke={BRAND_GREEN} strokeWidth="3" fill="none" />
      {/* Server lines */}
      <line x1="100" y1="82" x2="140" y2="82" stroke={BRAND_LIGHT} strokeWidth="2" />
      <line x1="100" y1="100" x2="140" y2="100" stroke={BRAND_LIGHT} strokeWidth="2" />
      <line x1="100" y1="118" x2="140" y2="118" stroke={BRAND_LIGHT} strokeWidth="2" />
      {/* Status dots */}
      <circle cx="132" cy="74" r="3" fill="#C62828" />
      <circle cx="132" cy="92" r="3" fill={BRAND_MUTED} />
      <circle cx="132" cy="110" r="3" fill={BRAND_MUTED} />
      {/* Warning triangle */}
      <path
        d="M120 42L130 58H110Z"
        stroke={BRAND_EMERALD}
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />
      <line x1="120" y1="48" x2="120" y2="53" stroke={BRAND_EMERALD} strokeWidth="2" strokeLinecap="round" />
      <circle cx="120" cy="56" r="1.2" fill={BRAND_EMERALD} />
      {/* Scattered elements */}
      <circle cx="55" cy="55" r="3" fill={BRAND_LIGHT} />
      <circle cx="190" cy="65" r="2.5" fill={BRAND_LIGHT} />
    </BaseSvg>
  );
}

function ServiceUnavailableIllustration() {
  return (
    <BaseSvg aria-label="Service unavailable illustration">
      <circle cx="120" cy="100" r="80" fill={BRAND_IVORY} />
      {/* Clock face */}
      <circle cx="120" cy="96" r="36" stroke={BRAND_GREEN} strokeWidth="3" fill="none" />
      {/* Clock hands */}
      <line x1="120" y1="96" x2="120" y2="76" stroke={BRAND_GREEN} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="120" y1="96" x2="136" y2="96" stroke={BRAND_EMERALD} strokeWidth="2.5" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx="120" cy="96" r="3" fill={BRAND_GREEN} />
      {/* Wrench */}
      <path
        d="M156 130l-12-12c2-4 2-9-1-12s-8-3-12-1l8 8-3 3-8-8c-2 4-2 9 1 12s8 3 12 1l12 12z"
        stroke={BRAND_EMERALD}
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
    </BaseSvg>
  );
}

function NetworkErrorIllustration() {
  return (
    <BaseSvg aria-label="Network error illustration">
      <circle cx="120" cy="100" r="80" fill={BRAND_IVORY} />
      {/* Wifi symbol - three arcs */}
      <path d="M88 82a48 48 0 0164 0" stroke={BRAND_LIGHT} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M96 92a32 32 0 0148 0" stroke={BRAND_LIGHT} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M104 102a16 16 0 0132 0" stroke={BRAND_LIGHT} strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="120" cy="112" r="4" fill={BRAND_LIGHT} />
      {/* Slash line */}
      <line x1="90" y1="120" x2="150" y2="72" stroke="#C62828" strokeWidth="3" strokeLinecap="round" />
      {/* Retry arrow */}
      <path
        d="M120 145c-12 0-20-8-20-18"
        stroke={BRAND_EMERALD}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M96 127l4 4 4-4" stroke={BRAND_EMERALD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </BaseSvg>
  );
}

function EmptyStateIllustration() {
  return (
    <BaseSvg aria-label="Empty state illustration">
      <circle cx="120" cy="100" r="80" fill={BRAND_IVORY} />
      {/* Open box */}
      <path d="M80 90h80v50H80z" stroke={BRAND_GREEN} strokeWidth="2.5" fill="none" />
      <path d="M80 90l20-20h40l20 20" stroke={BRAND_GREEN} strokeWidth="2.5" fill="none" strokeLinejoin="round" />
      {/* Box flaps */}
      <path d="M80 90l16-12" stroke={BRAND_EMERALD} strokeWidth="2" strokeLinecap="round" />
      <path d="M160 90l-16-12" stroke={BRAND_EMERALD} strokeWidth="2" strokeLinecap="round" />
      {/* Subtle sparkles */}
      <path d="M116 85v-8M120 81h-8" stroke={BRAND_LIGHT} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M140 75v-6M143 72h-6" stroke={BRAND_LIGHT} strokeWidth="1.5" strokeLinecap="round" />
    </BaseSvg>
  );
}

function MaintenanceIllustration() {
  return (
    <BaseSvg aria-label="Maintenance illustration">
      <circle cx="120" cy="100" r="80" fill={BRAND_IVORY} />
      {/* Gear */}
      <circle cx="110" cy="95" r="20" stroke={BRAND_GREEN} strokeWidth="3" fill="none" />
      <circle cx="110" cy="95" r="8" stroke={BRAND_EMERALD} strokeWidth="2" fill="none" />
      {/* Gear teeth */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 110 + Math.cos(rad) * 18;
        const y1 = 95 + Math.sin(rad) * 18;
        const x2 = 110 + Math.cos(rad) * 25;
        const y2 = 95 + Math.sin(rad) * 25;
        return (
          <line
            key={angle}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={BRAND_GREEN} strokeWidth="3" strokeLinecap="round"
          />
        );
      })}
      {/* Small gear */}
      <circle cx="145" cy="115" r="12" stroke={BRAND_EMERALD} strokeWidth="2" fill="none" />
      <circle cx="145" cy="115" r="5" stroke={BRAND_EMERALD} strokeWidth="1.5" fill="none" />
      {/* Hard hat */}
      <path d="M105 55c0-8 6.7-15 15-15s15 7 15 15" stroke={BRAND_GREEN} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <line x1="100" y1="55" x2="140" y2="55" stroke={BRAND_GREEN} strokeWidth="2.5" strokeLinecap="round" />
    </BaseSvg>
  );
}

function UnauthorizedIllustration() {
  return (
    <BaseSvg aria-label="Sign in required illustration">
      <circle cx="120" cy="100" r="80" fill={BRAND_IVORY} />
      {/* Lock body */}
      <rect x="100" y="92" width="40" height="34" rx="5" stroke={BRAND_GREEN} strokeWidth="3" fill="none" />
      {/* Lock shackle */}
      <path d="M108 92V80a12 12 0 0124 0v12" stroke={BRAND_GREEN} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Keyhole */}
      <circle cx="120" cy="106" r="5" fill={BRAND_EMERALD} />
      <rect x="118" y="108" width="4" height="8" rx="1" fill={BRAND_EMERALD} />
      {/* User silhouette */}
      <circle cx="120" cy="52" r="10" stroke={BRAND_LIGHT} strokeWidth="2" fill="none" />
      <path d="M104 72c0-10 7-16 16-16s16 6 16 16" stroke={BRAND_LIGHT} strokeWidth="2" fill="none" />
    </BaseSvg>
  );
}

function ForbiddenIllustration() {
  return (
    <BaseSvg aria-label="Access denied illustration">
      <circle cx="120" cy="100" r="80" fill={BRAND_IVORY} />
      {/* Shield */}
      <path
        d="M120 60l36 16v28c0 20-14 34-36 42-22-8-36-22-36-42V76z"
        stroke={BRAND_GREEN}
        strokeWidth="3"
        fill="none"
        strokeLinejoin="round"
      />
      {/* X mark */}
      <line x1="110" y1="92" x2="130" y2="112" stroke="#C62828" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="130" y1="92" x2="110" y2="112" stroke="#C62828" strokeWidth="3.5" strokeLinecap="round" />
    </BaseSvg>
  );
}

function SessionExpiredIllustration() {
  return (
    <BaseSvg aria-label="Session expired illustration">
      <circle cx="120" cy="100" r="80" fill={BRAND_IVORY} />
      {/* Hourglass */}
      <path
        d="M96 65h48M96 135h48"
        stroke={BRAND_GREEN} strokeWidth="3" strokeLinecap="round"
      />
      <path
        d="M100 65v16c0 10 8 16 20 19 12-3 20-9 20-19V65"
        stroke={BRAND_GREEN} strokeWidth="2.5" fill="none"
      />
      <path
        d="M100 135v-16c0-10 8-16 20-19 12 3 20 9 20 19v16"
        stroke={BRAND_GREEN} strokeWidth="2.5" fill="none"
      />
      {/* Sand grains */}
      <circle cx="116" cy="108" r="1.5" fill={BRAND_EMERALD} />
      <circle cx="124" cy="112" r="1.5" fill={BRAND_EMERALD} />
      <circle cx="120" cy="116" r="1.5" fill={BRAND_EMERALD} />
      {/* Falling sand line */}
      <line x1="120" y1="100" x2="120" y2="106" stroke={BRAND_EMERALD} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 3" />
    </BaseSvg>
  );
}

function TimeoutIllustration() {
  return (
    <BaseSvg aria-label="Request timeout illustration">
      <circle cx="120" cy="100" r="80" fill={BRAND_IVORY} />
      {/* Stopwatch body */}
      <circle cx="120" cy="104" r="34" stroke={BRAND_GREEN} strokeWidth="3" fill="none" />
      {/* Crown */}
      <line x1="120" y1="70" x2="120" y2="62" stroke={BRAND_GREEN} strokeWidth="3" strokeLinecap="round" />
      <line x1="114" y1="64" x2="126" y2="64" stroke={BRAND_GREEN} strokeWidth="2.5" strokeLinecap="round" />
      {/* Button */}
      <line x1="146" y1="78" x2="152" y2="72" stroke={BRAND_EMERALD} strokeWidth="2.5" strokeLinecap="round" />
      {/* Hands */}
      <line x1="120" y1="104" x2="120" y2="84" stroke={BRAND_GREEN} strokeWidth="2" strokeLinecap="round" />
      <line x1="120" y1="104" x2="138" y2="104" stroke="#C62828" strokeWidth="2" strokeLinecap="round" />
      <circle cx="120" cy="104" r="3" fill={BRAND_GREEN} />
      {/* Speed lines */}
      <line x1="62" y1="95" x2="72" y2="95" stroke={BRAND_LIGHT} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="58" y1="105" x2="70" y2="105" stroke={BRAND_LIGHT} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="62" y1="115" x2="72" y2="115" stroke={BRAND_LIGHT} strokeWidth="1.5" strokeLinecap="round" />
    </BaseSvg>
  );
}

const ILLUSTRATIONS = {
  "not-found": NotFoundIllustration,
  "server-error": ServerErrorIllustration,
  "service-unavailable": ServiceUnavailableIllustration,
  "network-error": NetworkErrorIllustration,
  "empty": EmptyStateIllustration,
  "maintenance": MaintenanceIllustration,
  "unauthorized": UnauthorizedIllustration,
  "forbidden": ForbiddenIllustration,
  "session-expired": SessionExpiredIllustration,
  "timeout": TimeoutIllustration,
};

export default function ErrorIllustration({ type = "server-error", className = "" }) {
  const Component = ILLUSTRATIONS[type] || ServerErrorIllustration;
  return <Component className={className} />;
}

export { ILLUSTRATIONS };
