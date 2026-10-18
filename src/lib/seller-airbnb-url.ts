import type { Hotel } from "./hotels";

/**
 * Seller-only Airbnb booking link. The listing number comes from the provider,
 * never from arbitrary third-party links.
 * Airbnb can still change availability, fees or the final quote at checkout.
 */
export function sellerAirbnbUrl(
  hotel: Pick<Hotel, "provider" | "providerListingId" | "sourceUrl">,
  stay: { checkin: string; checkout: string; adults: number },
): string | null {
  if (hotel.provider !== "airbnb") return null;
  let id = hotel.providerListingId;
  if (!id && hotel.sourceUrl) {
    try {
      const url = new URL(hotel.sourceUrl);
      if (!["airbnb.com", "www.airbnb.com", "airbnb.com.br", "www.airbnb.com.br"].includes(url.hostname)) return null;
      id = url.pathname.match(/^\/rooms\/(\d{6,22})(?:\/)?$/)?.[1];
    } catch { return null; }
  }
  if (!id || !/^\d{6,22}$/.test(id)) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (!date.test(stay.checkin) || !date.test(stay.checkout) || stay.checkout <= stay.checkin) return null;
  const adults = Math.max(1, Math.min(30, Math.floor(stay.adults || 1)));
  const url = new URL(`https://www.airbnb.com.br/rooms/${id}`);
  url.searchParams.set("check_in", stay.checkin);
  url.searchParams.set("check_out", stay.checkout);
  url.searchParams.set("adults", String(adults));
  return url.href;
}
