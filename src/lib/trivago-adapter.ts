import type { Hotel } from "./hotels";
import type { TrivagoItem, TrivagoDetails, TrivagoStay } from "./gecko-trivago.server";

/**
 * PLP is identity discovery only. Its forecast is never a nightly or stay quote.
 * Search results must be enriched with dated PDP pricePerStay before display.
 */
export function normalizeTrivagoItems(items: TrivagoItem[], nights: number): Hotel[] {
  const byId = new Set<string>();
  return items.flatMap(item => {
    if (!Number.isInteger(item.id) || !item.id || !Number.isInteger(nights) || nights < 1) return [];
    const id = `trivago:${item.namespace ?? 100}:${item.id}`;
    if (byId.has(id)) return [];
    byId.add(id);
    const url = item.url?.trim() ?? "";
    let sourceUrl = "";
    try {
      const u = new URL(url);
      if (u.protocol === "https:" && (u.hostname === "www.trivago.com.br" || u.hostname === "trivago.com.br")) sourceUrl = u.href;
    } catch { /* No verified public URL. */ }
    return [{
      id, provider: "trivago" as const, providerListingId: String(item.id),
      ...(sourceUrl ? { sourceUrl } : {}),
      name: item.name?.trim() || "Hotel no Trivago",
      address: item.location?.trim() ?? "",
      stars: Math.max(0, Math.min(5, Math.round(item.starRating ?? 0))),
      rating: typeof item.reviewScore === "number" ? item.reviewScore / 2 : undefined,
      reviewCount: item.reviewCount,
      nightly: 0,
      total: 0,
      totalEstimated: true,
      priceConfirmed: false,
      room: [item.accommodationType, ...(item.highlights ?? [])].filter(Boolean).join(" · "),
      image: item.image ?? "", images: item.image ? [item.image] : [],
      x: 50, y: 50,
    }];
  }).sort((a,b) => a.total - b.total);
}

/** Lowest returned BRL stay total for the exact requested occupancy and dates.
 * The contract does not guarantee all mandatory fees: never auto-confirm it.
 */
export function applyTrivagoStayPrice(hotel: Hotel, details: TrivagoDetails | null, stay: TrivagoStay): Hotel | null {
  if (!details || String(details.id) !== hotel.providerListingId ||
      details.checkinDate !== stay.checkinDate || details.checkoutDate !== stay.checkoutDate ||
      details.numAdults !== stay.numAdults || details.numChildren !== stay.numChildren ||
      details.numRooms !== stay.numRooms || details.currency?.toUpperCase() !== "BRL") return null;
  const nights = (Date.parse(stay.checkoutDate) - Date.parse(stay.checkinDate)) / 86400000;
  if (!Number.isInteger(nights) || nights < 1) return null;
  const deals = (details.deals ?? []).filter(deal =>
    deal.pricePerStay?.currency?.toUpperCase() === "BRL" &&
    typeof deal.pricePerStay.amount === "number" && Number.isFinite(deal.pricePerStay.amount) && deal.pricePerStay.amount > 0);
  const cheapest = deals.sort((a, b) => (a.pricePerStay?.amount ?? Infinity) - (b.pricePerStay?.amount ?? Infinity))[0];
  const amount = cheapest?.pricePerStay?.amount;
  if (!cheapest || amount === undefined) return null;
  const total = Math.round(amount * 100) / 100;
  return { ...hotel, total, nightly: Math.round(total / nights * 100) / 100,
    room: cheapest.roomCategory || cheapest.description || "", supplierName: cheapest.advertiser?.name,
    totalEstimated: false, priceConfirmed: false };
}
