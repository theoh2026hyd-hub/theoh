import { BRAND_NAME, BRAND_TELUGU } from "../lib/brand";

export default function BrandName({
  inline = true,
  showTelugu = false,
  className = "",
}) {
  if (showTelugu) {
    return (
      <span className={`brand-name-stack ${className}`.trim()}>
        <span className="logo-main-text">{BRAND_NAME}</span>
        <span className="logo-telugu-text">{BRAND_TELUGU}</span>
      </span>
    );
  }

  if (!inline) {
    return (
      <span className={`brand-name-block ${className}`.trim()}>
        <span className="logo-main-text">{BRAND_NAME}</span>
      </span>
    );
  }

  return (
    <span className={`brand-name-inline ${className}`.trim()}>
      <span className="logo-main-text">{BRAND_NAME}</span>
    </span>
  );
}
