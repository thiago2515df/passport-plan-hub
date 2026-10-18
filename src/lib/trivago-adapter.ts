import type { Hotel } from "./hotels";
import type { TrivagoItem } from "./gecko-trivago.server";

/**
 * PLP returns a *forecasted* advertised amount, not a confirmed supplier
 * offer, stay total or final price including fees. Never label it as bookable.
 * For comparison only, assume the reference applies per night; the seller
 * MUST check and explicitly confirm the total before issuing a proposal.
 */
export function normalizeTrivagoItems(items: TrivagoItem[], nights: number): Hotel[] {
  const byId = new Set<string>();
  return items.flatMap(item => {
    const price = item.forecastedPrice;
    const amount = price?.amount;
    if (!Number.isInteger(item.id) || !item.id || !Number.isFinite(amount) || (amount ?? 0) <= 0 ||
        price?.currency?.toUpperCase() !== "BRL") return [];
    const id = `trivago:${item.namespace ?? 100}:${item.id}`;
    if (byId.has(id)) return [];
    byId.add(id);
    const url = item.url?.trim() ?? "";
    let sourceUrl = "";
    try {
      const u = new URL(url);
      if (u.protocol === "https:" && (u.hostname === "www.trivago.com.br" || u.hostname === "trivago.com.br")) sourceUrl = u.href;
    } catch { /* No verified public URL. */ }
    const estimate = Math.round((amount ?? 0) * 100) / 100;
    const total = Math.round(estimate * nights * 100) / 100;
    return [{
      id, provider: "trivago" as const, providerListingId: String(item.id),
      ...(sourceUrl ? { sourceUrl } : {}),
      name: item.name?.trim() || "Hotel no Trivago",
      address: item.location?.trim() ?? "",
      stars: Math.max(0, Math.min(5, Math.round(item.starRating ?? 0))),
      rating: typeof item.reviewScore === "number" ? item.reviewScore / 2 : undefined,
      reviewCount: item.reviewCount,
      nightly: estimate,
      total,
      totalEstimated: true,
      priceConfirmed: false,
      room: [item.accommodationType, ...(item.highlights ?? [])].filter(Boolean).join(" · "),
      image: item.image ?? "", images: item.image ? [item.image] : [],
      x: 50, y: 50,
    }];
  }).sort((a,b) => a.total - b.total);
}
