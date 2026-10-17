import type { AirbnbPropertyDetails, Hotel, Search } from "./hotels";

type SavedHotel = Omit<Hotel, "id" | "x" | "y">;

// One PDP request per selected Airbnb when creating a customer proposal.
// Caching across requests avoids repeated paid requests for the same listing.
const cache = new Map<string, { until: number; details: AirbnbPropertyDetails }>();
const TTL_MS = 12 * 60 * 60 * 1000;
const MAX_AUTO_DETAILS_PER_PROPOSAL = 8;

export async function addAirbnbDetailsToProposal(
  hotels: SavedHotel[],
  stay: Pick<Search, "checkin" | "checkout" | "adults">,
): Promise<SavedHotel[]> {
  if (!process.env["GECKO_API_TOKEN"]?.trim()) return hotels;

  const { geckoAirbnbDetails } = await import("./gecko-airbnb.server");
  const { normalizeAirbnbPdp } = await import("./airbnb-pdp-details");
  let calls = 0;

  return Promise.all(hotels.map(async hotel => {
    if (hotel.provider !== "airbnb" || hotel.publicDetails?.photos.length) return hotel;
    const id = hotel.providerListingId;
    if (!id || !/^\d{6,22}$/.test(id) || calls >= MAX_AUTO_DETAILS_PER_PROPOSAL) return hotel;

    const key = [id, stay.checkin, stay.checkout, stay.adults ?? 2].join(":");
    const cached = cache.get(key);
    if (cached && cached.until > Date.now()) {
      return { ...hotel, publicDetails: cached.details };
    }

    calls++;
    try {
      const response = await geckoAirbnbDetails({
        listingId: id,
        startDate: stay.checkin,
        endDate: stay.checkout,
        numAdults: stay.adults ?? 2,
      });
      const details = normalizeAirbnbPdp(response);
      if (!details) return hotel;
      cache.set(key, { until: Date.now() + TTL_MS, details });
      if (cache.size > 200) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey) cache.delete(oldestKey);
      }
      return {
        ...hotel,
        publicDetails: details,
        ...(typeof details.rating === "number" ? { rating: details.rating } : {}),
        ...(typeof details.reviewCount === "number" ? { reviewCount: details.reviewCount } : {}),
      };
    } catch (error) {
      console.warn("Airbnb PDP not available while preparing proposal:", error instanceof Error ? error.message : String(error));
      return hotel;
    }
  }));
}
