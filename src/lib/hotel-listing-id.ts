import type { Hotel } from "./hotels";

/**
 * Public proposals deliberately omit Hotel.id. A details popup must never
 * assume this internal offer ID is present. Airbnb's providerListingId is
 * preserved separately, when available.
 */
export function airbnbListingId(
  hotel: Pick<Hotel, "provider" | "providerListingId"> & Partial<Pick<Hotel, "id">>,
): string {
  if (hotel.provider !== "airbnb") return "";
  const candidate = hotel.providerListingId
    ?? (typeof hotel.id === "string" ? hotel.id.replace(/^airbnb:/, "") : "");
  return /^\d{6,22}$/.test(candidate) ? candidate : "";
}
