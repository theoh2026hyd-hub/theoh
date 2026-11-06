import { SIZE_LABELS, shouldHideSizeQuantityLabel } from "./productSizes";

const SIZE_PATTERN = new RegExp(`^(.+?)\\s*\\((${SIZE_LABELS.join("|")})\\)$`, "i");

export function parseSizeFromItemName(name) {
  if (!name || typeof name !== "string") {
    return { baseName: name || "", sizeLabel: null };
  }
  const match = name.match(SIZE_PATTERN);
  if (match) {
    return { baseName: match[1].trim(), sizeLabel: match[2] };
  }
  return { baseName: name, sizeLabel: null };
}

export function getItemSizeLabel(item) {
  if (!item) return null;
  if (shouldHideSizeQuantityLabel(item)) return null;
  if (item.sizeLabel) return item.sizeLabel;
  if (item.size_label) return item.size_label;
  return parseSizeFromItemName(item.name).sizeLabel;
}

export function getItemBaseName(item) {
  if (!item?.name) return "";
  if (item.sizeLabel && !SIZE_PATTERN.test(item.name)) {
    return item.name;
  }
  return parseSizeFromItemName(item.name).baseName;
}

export function formatOrderItemSummary(item) {
  const qty = item.quantity || 1;
  const base = getItemBaseName(item);
  const size = getItemSizeLabel(item);
  if (size) return `${qty}x ${base} (${size})`;
  return `${qty}x ${base}`;
}
