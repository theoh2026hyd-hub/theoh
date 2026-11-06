import { getItemSizeLabel } from "../lib/cartDisplay";

export default function ItemSizeBadge({ item, className = "" }) {
  const size = getItemSizeLabel(item);
  if (!size) return null;

  return (
    <span className={`item-size-badge ${className}`.trim()}>
      {size}
    </span>
  );
}
