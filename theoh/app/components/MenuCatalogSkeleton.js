"use client";

export default function MenuCatalogSkeleton({ count }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={`menu-skeleton-${index}`}
          className="menu-card-wrapper menu-card-skeleton"
          aria-hidden="true"
        >
          <div className="card-image-container">
            <div className="menu-card-skeleton-image skeleton" />
          </div>
          <div className="card-content">
            <div className="skeleton menu-card-skeleton-meta" />
            <div className="skeleton menu-card-skeleton-title" />
            <div className="skeleton menu-card-skeleton-desc" />
            <div className="skeleton menu-card-skeleton-desc menu-card-skeleton-desc-short" />
            <div className="card-footer card-footer-with-menu card-footer-stacked">
              <div className="card-footer-actions">
                <div className="skeleton menu-card-skeleton-price" />
                <div className="skeleton menu-card-skeleton-btn" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
