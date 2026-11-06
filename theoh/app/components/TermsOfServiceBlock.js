"use client";

import { TERMS_SECTIONS } from "../lib/termsContent";

export default function TermsOfServiceBlock({ compact = false, variant = "dark", hideTitle = false }) {
  return (
    <div
      className={`terms-of-service-block${compact ? " terms-of-service-block--compact" : ""}${variant === "light" ? " terms-of-service-block--light" : ""}`}
    >
      {!hideTitle && <h4 className="terms-block-title">Terms of Service</h4>}
      <p className="terms-block-intro">
        By placing an order with THE OH !, you agree to the following terms. Please read them before checkout.
      </p>
      <div className="terms-sections-list">
        {TERMS_SECTIONS.map((section) => (
          <div
            key={section.title}
            className={`terms-section-item${section.wide ? " terms-section-item--wide" : ""}`}
          >
            <h5>{section.title}</h5>
            <p>{section.body}</p>
            {Array.isArray(section.points) && section.points.length > 0 && (
              <ul className="terms-section-points">
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
