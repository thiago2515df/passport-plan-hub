import type { Hotel } from "./hotels";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === "object" && !Array.isArray(v) ? v as Obj : {};
const str = (v: unknown) => typeof v === "string" ? v.trim() : "";
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : undefined;
export const bookingPhotos = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && /^https:\/\//i.test(x)))].slice(0, 40) : [];
export function bookingUrl(v: unknown): string | undefined {
  try { const u = new URL(str(v)); return u.protocol === "https:" && (u.hostname === "booking.com" || u.hostname.endsWith(".booking.com")) ? u.href : undefined; } catch { return undefined; }
}
export function bookingStayPrice(v: unknown, nights: number) {
  const p = obj(v), total = num(p["totalPrice"]);
  if (p["currency"] !== "BRL" || total === undefined || total <= 0 || p["nights"] !== nights) return null;
  return { total, nightly: total / nights };
}
export function normalizeBookingProperty(value: unknown, nights: number): Hotel | null {
  const p = obj(value), location = obj(p["location"]), id = str(p["platformListingId"]), name = str(p["name"]);
  if (p["platform"] !== "booking" || !id || !name) return null;
  const price = bookingStayPrice(p["price"], nights);
  const images = bookingPhotos(p["images"]);
  const latitude = num(location["lat"]), longitude = num(location["lng"]), rating = num(p["guestRating"]), reviewCount = num(p["reviewCount"]);
  const sourceUrl = bookingUrl(p["url"]);
  return { id: "booking:" + id, provider: "booking", providerListingId: id, name, address: str(location["address"]) || [str(location["city"]), str(location["country"])].filter(Boolean).join(", "), stars: Math.max(0, Math.min(5, Math.floor(num(p["starRating"]) ?? 0))), room: "", image: images[0] ?? "", images, x: 50, y: 50, total: price?.total ?? 0, nightly: price?.nightly ?? 0, priceConfirmed: false, totalEstimated: true, supplierName: "Booking.com",
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(latitude !== undefined && longitude !== undefined && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : {}),
    ...(rating !== undefined && rating >= 0 && rating <= 10 && p["ratingScale"] === 10 ? { rating } : {}),
    ...(reviewCount !== undefined && reviewCount >= 0 ? { reviewCount } : {}),
    ...(!price ? { quoteError: "A busca não retornou uma tarifa total em reais para este período." } : {}) };
}
