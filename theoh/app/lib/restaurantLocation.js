import { looksLikeCoordinateAddress } from "./contactInfo";

export const DEFAULT_RESTAURANT_MAP_LINK = "https://maps.app.goo.gl/nCmjf7L4mX2zdskt6";

export const DEFAULT_RESTAURANT_LOCATION_LABEL = "Hyderabad, Telangana, India";

export const DEFAULT_RESTAURANT_MAP_EMBED =
  "https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d3619.155609450031!2d78.37295999999999!3d17.385372999999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zMTfCsDIzJzA3LjMiTiA3OMKwMjInMjIuNyJF!5e1!3m2!1sen!2sin!4v1782893765574!5m2!1sen!2sin";

export function getRestaurantMapLink(settings) {
  const link = settings?.restaurant_map_link?.trim();
  return link || DEFAULT_RESTAURANT_MAP_LINK;
}

/** Public label for cloud kitchen (same source as Delivery Coverage). */
export function getRestaurantLocationLabel(settings) {
  const addr = settings?.restaurant_address?.trim();
  if (addr && !looksLikeCoordinateAddress(addr)) return addr;
  return DEFAULT_RESTAURANT_LOCATION_LABEL;
}

export function getRestaurantMapEmbedUrl(settings) {
  const embed = settings?.restaurant_map_embed?.trim();
  if (embed) return embed;

  return DEFAULT_RESTAURANT_MAP_EMBED;
}
