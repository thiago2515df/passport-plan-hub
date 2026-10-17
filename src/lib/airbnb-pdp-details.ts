import type { AirbnbPropertyDetails } from "./hotels";
import type { GeckoAirbnbPdpResponse } from "./gecko-airbnb.server";

/** Only public, bounded Airbnb PDP fields are allowed in proposal snapshots. */
export function normalizeAirbnbPdp(
  response: GeckoAirbnbPdpResponse,
): AirbnbPropertyDetails | null {
  const data = response.notFound ? null : response.data?.data;
  if (!data) return null;

  const text = (value: unknown, limit = 160) =>
    typeof value === "string" ? value.trim().slice(0, limit) : "";
  const strings = (value: unknown, max = 30, limit = 140) =>
    Array.isArray(value)
      ? Array.from(new Set(value.filter((item): item is string => typeof item === "string")
          .map(item => text(item, limit)).filter(Boolean))).slice(0, max)
      : [];
  const safePhoto = (value: unknown) => {
    if (typeof value !== "string") return "";
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  };

  const photos = Array.from(new Set([
    safePhoto(data.mainImage?.url),
    ...(Array.isArray(data.image) ? data.image.map(item => safePhoto(item?.url)) : []),
  ].filter(Boolean))).slice(0, 32);

  const rating = typeof data.aggregateRating?.rating === "number"
    && Number.isFinite(data.aggregateRating.rating)
    && data.aggregateRating.rating >= 0 && data.aggregateRating.rating <= 5
    ? data.aggregateRating.rating : undefined;
  const reviewCount = typeof data.aggregateRating?.reviewCount === "number"
    && Number.isInteger(data.aggregateRating.reviewCount)
    && data.aggregateRating.reviewCount >= 0
    ? data.aggregateRating.reviewCount : undefined;
  const personCapacity = typeof data.personCapacity === "number"
    && Number.isInteger(data.personCapacity) && data.personCapacity > 0
    ? data.personCapacity : undefined;

  return {
    photos,
    description: text(data.description, 6000),
    amenities: strings(data.amenities),
    highlights: strings(data.highlights, 20),
    propertyType: text(data.propertyType),
    cancellationPolicy: text(data.cancellationPolicy, 1000),
    hostName: text(data.host?.name),
    ...(rating === undefined ? {} : { rating }),
    ...(reviewCount === undefined ? {} : { reviewCount }),
    ...(personCapacity === undefined ? {} : { personCapacity }),
    roomType: text(data.roomType),
    city: text(data.city),
    badges: strings(data.badges, 12),
    isSuperhost: data.isSuperhost === true || data.host?.isSuperhost === true,
  };
}
