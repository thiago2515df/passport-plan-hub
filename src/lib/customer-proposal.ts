import { packagePricing, type SellerCommissions } from "@/lib/package-pricing";
import { decodeProposal, type TransportLeg } from "@/lib/hotels";

/** Explicit public projection: never spread internal service or pricing data. */
export function customerProposal(p: NonNullable<ReturnType<typeof decodeProposal>>, commissions?: SellerCommissions) {
  const s = p.s;
  const leg = (v: TransportLeg): TransportLeg => ({ company: v.company, departure: v.departure, arrival: v.arrival, ticket: v.ticket, from: v.from ?? "", to: v.to ?? "", duration: v.duration ?? "", stops: v.stops ?? "", airline: v.airline, flightNumber: v.flightNumber, departureDate: v.departureDate, arrivalDate: v.arrivalDate, fareCategory: v.fareCategory, connections: v.connections, connectionDetails: v.connectionDetails, baggage: v.baggage });
  return { s: { destino: s.destino, checkin: s.checkin, checkout: s.checkout, hospedes: s.hospedes, cliente: s.cliente ?? "", origem: s.origem ?? "", rooms: s.rooms ?? 1, adults: s.adults ?? 2, childAges: s.childAges ?? [], ...(s.roomOccupancies ? { roomOccupancies: s.roomOccupancies } : {}), rav: 0, extras: (s.extras ?? []).map(item => ({ name: item.name, cost: 0 })), ...(s.transport ? { transport: { mode: s.transport.mode, outbound: leg(s.transport.outbound), inbound: leg(s.transport.inbound), travelClass: s.transport.travelClass ?? "", bags: s.transport.bags ?? "" } } : {}) }, hotels: p.hotels.map(h => {
    const extras = h.extras ?? s.extras ?? [];
    return {
      name: h.name, address: h.address, stars: h.stars, room: h.room ?? "", image: h.image,
      ...(h.hotelId !== undefined ? { hotelId: h.hotelId } : {}),
      // Keep only public Airbnb identity, photos and review metadata. Without
      // providerListingId and the saved PDP snapshot keep client details available.
      ...((h.provider === "airbnb" || h.provider === "trivago") ? {
        provider: h.provider,
        ...(h.providerListingId ? { providerListingId: h.providerListingId } : {}),
        ...(h.sourceUrl ? { sourceUrl: h.sourceUrl } : {}),
        ...(h.rating != null ? { rating: h.rating } : {}),
        ...(h.reviewCount != null ? { reviewCount: h.reviewCount } : {}),
        images: h.images ?? [],
        ...(h.publicDetails ? { publicDetails: h.publicDetails } : {}),
        ...(h.totalEstimated ? { totalEstimated: true } : {}),
      } : {}),
      extras: extras.map(item => ({ name: item.name, cost: 0 })), nightly: 0, total: packagePricing(h.total, { ...s, extras }, commissions).total };
  }) };
}
