import type { Hotel, Search } from "./hotels";

type SavedHotel = Omit<Hotel, "id" | "x" | "y">;

/**
 * Airbnb PDP enrichment is intentionally disabled.
 * The GeckoAPI PDP extraction is a separate paid request, so customer proposals
 * use only the information already returned by the PLP search.
 */
export async function addAirbnbDetailsToProposal(
  hotels: SavedHotel[],
  _stay: Pick<Search, "checkin" | "checkout" | "adults">,
): Promise<SavedHotel[]> {
  return hotels;
}
