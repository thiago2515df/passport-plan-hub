import { bookingPhotos, bookingStayPrice, normalizeBookingProperty } from "./booking-adapter";
import type { Hotel } from "./hotels";
import { stayingGet, stayingError } from "./staying-api-http.server";

export type BookingPeriod = { checkinDate: string; checkoutDate: string; numAdults: number; numChildren: number; childAges: number[]; numRooms: number };
const nights = (p: BookingPeriod) => Math.round((Date.parse(p.checkoutDate) - Date.parse(p.checkinDate)) / 86400000);
async function get(path: string, params: URLSearchParams) {
  const key = process.env.STAYINGAPI_KEY?.trim();
  if (!key) throw new Error("Configure STAYINGAPI_KEY no servidor.");
  if (key.startsWith("stay_test_")) throw new Error("Chave de sandbox: cadastre uma chave Live para pesquisar valores reais.");
  return stayingGet(path, params, key);
}
function periodParams(p: BookingPeriod) {
  const q = new URLSearchParams({ checkIn: p.checkinDate, checkOut: p.checkoutDate, adults: String(p.numAdults), children: String(p.numChildren), currency: "BRL" });
  for (const age of p.childAges) q.append("childAges[]", String(age));
  return q;
}
export async function bookingSearch(p: BookingPeriod & { location: string; cursor?: string }) {
  const q = periodParams(p);
  q.set("location", p.location); q.set("platforms", "booking"); q.set("rooms", String(p.numRooms)); q.set("limit", "20"); q.set("sort", "price_asc");
  // The current OpenAPI contract returns one page; cursors are no longer supported.
  const result = await get("search", q);
  if (!Array.isArray(result.data)) throw new Error("StayingAPI: formato inesperado dos resultados.");
  const booking = result.meta?.platformResults?.find(x => x.platform === "booking");
  if (booking?.status === "failed") throw stayingError(503, booking.error);
  if (booking?.status === "skipped") throw stayingError(403, { code: booking.reason === "not_enabled" ? "platform_not_enabled" : "invalid_parameter" });
  const listings = result.data.map(v => normalizeBookingProperty(v, nights(p))).filter((h): h is Hotel => h !== null);
  if (result.data.length && !listings.length) throw new Error("StayingAPI: recebeu hospedagens, mas o formato ou fornecedor não corresponde ao Booking.com.");
  const warnings = result.meta?.warnings?.map(w => w.code).filter((v): v is string => typeof v === "string" && /^[a-z0-9_]{1,80}$/.test(v)) ?? [];
  const warning = [result.meta?.partial ? "A StayingAPI retornou resultados parciais." : "", warnings.length ? "Avisos da StayingAPI: " + warnings.join(", ") : ""].filter(Boolean).join(" ");
  return { listings, ...(warning ? { warning } : {}) };
}
export async function bookingQuote(p: BookingPeriod & { listingId: string }) {
  const q = periodParams(p); q.set("platform", "booking"); q.set("listingId", p.listingId);
  const result = await get("price", q);
  const raw = result.data as { platform?: unknown; listingId?: unknown } | undefined;
  const price = raw?.platform === "booking" && raw.listingId === p.listingId ? bookingStayPrice(raw, nights(p)) : null;
  if (!price) throw new Error("Não foi retornada uma tarifa total válida em reais para este hotel e período.");
  return { ...price, supplierName: "Booking.com", room: "" };
}
type Details = { images: string[]; description: string; amenities: string[] };
const detailCache = new Map<string, { expires: number; promise: Promise<Details> }>();
export async function bookingDetails(id: string): Promise<Details> {
  const cached = detailCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.promise;
  if (detailCache.size >= 200) detailCache.delete(detailCache.keys().next().value!);
  const promise = get("listing/booking/" + encodeURIComponent(id), new URLSearchParams()).then(result => {
    const d = result.data as { platform?: unknown; platformListingId?: unknown; images?: unknown; description?: unknown; amenities?: unknown } | undefined;
    if (d?.platform !== "booking" || d.platformListingId !== id) throw new Error("A API não confirmou a identidade da hospedagem.");
    return { images: bookingPhotos(d.images), description: typeof d.description === "string" ? d.description.slice(0, 12000) : "", amenities: Array.isArray(d.amenities) ? d.amenities.filter((a): a is string => typeof a === "string").slice(0, 50) : [] };
  }).catch(error => { detailCache.delete(id); throw error; });
  detailCache.set(id, { expires: Date.now() + 24 * 3600000, promise });
  return promise;
}
export async function snapshotBooking<T extends Omit<Hotel, "id" | "x" | "y">>(hotel: T): Promise<T> {
  if (hotel.provider !== "booking" || !hotel.providerListingId || hotel.publicDetails) return hotel;
  try {
    const details = await bookingDetails(hotel.providerListingId);
    const images = [...new Set([...details.images, ...(hotel.images ?? []), hotel.image].filter(Boolean))].slice(0, 40);
    return { ...hotel, images, image: images[0] ?? "", publicDetails: { photos: images, description: details.description, amenities: details.amenities, highlights: [], propertyType: "", cancellationPolicy: "", hostName: "" } };
  } catch { return hotel; }
}
