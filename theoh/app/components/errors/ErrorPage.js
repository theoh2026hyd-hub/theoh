"use client";

import { useRouter } from "next/navigation";
import { Home, ArrowLeft, RefreshCw, LogIn } from "lucide-react";
import ErrorIllustration from "./ErrorIllustration";

/**
 * ErrorPage — Full-page branded error component.
 * Used by not-found.js, error.js, global-error.js, and standalone error pages.
 *
 * Props:
 *   statusCode   — HTTP status code (displayed subtly)
 *   title        — Main heading text
 *   description  — Friendly explanation
 *   illustration — ErrorIllustration type string
 *   actions      — Array of { label, onClick, href, icon, variant } objects
 *   showNavbar   — Whether the page includes its own back/home chrome
 *   onReset      — Next.js error boundary reset function
 */

const ACTION_ICONS = {
  home: Home,
  back: ArrowLeft,
  retry: RefreshCw,
  login: LogIn,
};

export default function ErrorPage({
  statusCode,
  title = "Something Went Wrong",
  description = "We couldn't load this page right now. Please try again.",
  illustration = "server-error",
  actions = [],
  onReset,
  children,
}) {
  const router = useRouter();

  const defaultActions = actions.length > 0
    ? actions
    : [
        { label: "Go Home", icon: "home", href: "/", variant: "primary" },
        { label: "Go Back", icon: "back", onClick: () => router.back(), variant: "secondary" },
      ];

  const handleAction = (action) => {
    if (action.onClick) {
      action.onClick();
    } else if (action.href) {
      window.location.href = action.href;
    } else if (action.icon === "back") {
      router.back();
    }
  };

  return (
    <div className="error-page" role="main">
      <div className="error-page-content">
        <div className="error-page-illustration">
          <ErrorIllustration type={illustration} />
        </div>

        {statusCode && (
          <span className="error-page-code" aria-hidden="true">
            {statusCode}
          </span>
        )}

        <h1 className="error-page-title">{title}</h1>
        <p className="error-page-description">{description}</p>

        {children}

        <div className="error-page-actions">
          {defaultActions.map((action, index) => {
            const IconComponent = ACTION_ICONS[action.icon] || null;
            const variant = action.variant || (index === 0 ? "primary" : "secondary");

            return (
              <button
                key={action.label}
                type="button"
                className={`error-page-btn error-page-btn--${variant}`}
                onClick={() => handleAction(action)}
                aria-label={action.label}
              >
                {IconComponent && <IconComponent size={16} aria-hidden="true" />}
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
