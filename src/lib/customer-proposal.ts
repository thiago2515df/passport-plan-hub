import { packagePricing, type SellerCommissions } from "@/lib/package-pricing";
import { decodeProposal, type Flight, type TransportLeg } from "@/lib/hotels";

/** Explicit public projection: never spread internal service or pricing data. */
export function customerProposal(p: NonNullable<ReturnType<typeof decodeProposal>>, commissions?: SellerCommissions) {
  const s = p.s;
  const leg = (v: TransportLeg): TransportLeg => ({ company: v.company, departure: v.departure, arrival: v.arrival, ticket: v.ticket, from: v.from ?? "", to: v.to ?? "", duration: v.duration ?? "", stops: v.stops ?? "", airline: v.airline, flightNumber: v.flightNumber, departureDate: v.departureDate, arrivalDate: v.arrivalDate, fareCategory: v.fareCategory, connections: v.connections, connectionDetails: v.connectionDetails, baggage: v.baggage });
  const flight = (v: Flight) => ({
    id: v.id,
    airline: v.airline,
    flightNumber: v.flightNumber,
    from: v.from,
    to: v.to,
    departure: v.departure,
    arrival: v.arrival,
    duration: v.duration,
    stops: v.stops,
    travelClass: v.travelClass,
    bags: v.bags,
    departureDate: v.departureDate,
    arrivalDate: v.arrivalDate,
    fareCategory: v.fareCategory,
    connections: v.connections,
    connectionDetails: v.connectionDetails,
    baggage: v.baggage,
  });
  return { s: { ...(s.blackFriday === true ? { blackFriday: true } : {}), destino: s.destino, checkin: s.checkin, checkout: s.checkout, hospedes: s.hospedes, cliente: s.cliente ?? "", origem: s.origem ?? "", paymentRules: s.paymentRules, ...(s.interestFreeInstallments !== undefined ? { interestFreeInstallments: s.interestFreeInstallments } : {}), rooms: s.rooms ?? 1, adults: s.adults ?? 2, childAges: s.childAges ?? [], ...(s.roomOccupancies ? { roomOccupancies: s.roomOccupancies } : {}), rav: 0, extras: (s.extras ?? []).map(item => ({ name: item.name, cost: 0 })), ...(s.transport ? { transport: { mode: s.transport.mode, outbound: leg(s.transport.outbound), inbound: leg(s.transport.inbound), travelClass: s.transport.travelClass ?? "", bags: s.transport.bags ?? "" } } : {}), ...(s.selectedFlightOptions ? { selectedFlightOptions: { out: (s.selectedFlightOptions.out ?? []).map(flight), back: (s.selectedFlightOptions.back ?? []).map(flight) } } : {}),
    ...(s.multiHotelStays?.length ? { multiHotelStays: s.multiHotelStays.map((stay, index) => ({
      checkin: stay.checkin, checkout: stay.checkout,
      ...(stay.hotel ? { hotel: {
        id: `multi-public-${index}`,
        name: stay.hotel.name, address: stay.hotel.address, stars: stay.hotel.stars,
        room: stay.hotel.room ?? "", image: stay.hotel.image,
        images: stay.hotel.images ?? [],
        ...(stay.hotel.provider ? { provider: stay.hotel.provider } : {}),
        ...(stay.hotel.hotelId !== undefined ? { hotelId: stay.hotel.hotelId } : {}),
        ...(stay.hotel.rating !== undefined ? { rating: stay.hotel.rating } : {}),
        ...(stay.hotel.reviewCount !== undefined ? { reviewCount: stay.hotel.reviewCount } : {}),
        ...(stay.hotel.publicDetails ? { publicDetails: stay.hotel.publicDetails } : {}),
        nightly: 0, total: 0, x: 50, y: 50,
      } } : {}),
    })) } : {}) }, hotels: p.hotels.map(h => {
    const extras = s.multiHotelStays?.length ? (s.extras ?? []) : (h.extras ?? s.extras ?? []);
    return {
      name: h.name, address: h.address, stars: h.stars, room: h.room ?? "", image: h.image,
      ...(h.hotelId !== undefined ? { hotelId: h.hotelId } : {}),
      // Keep only public Airbnb identity, photos and review metadata. Without
      // providerListingId and the saved PDP snapshot keep client details available.
      ...((h.provider === "airbnb" || h.provider === "trivago" || h.provider === "booking") ? {
        provider: h.provider,
        ...(h.providerListingId && h.provider !== "booking" ? { providerListingId: h.providerListingId } : {}),
        ...(h.sourceUrl && h.provider !== "booking" ? { sourceUrl: h.sourceUrl } : {}),
        ...(h.rating != null ? { rating: h.rating } : {}),
        ...(h.reviewCount != null ? { reviewCount: h.reviewCount } : {}),
        images: h.images ?? [],
        ...(h.publicDetails ? { publicDetails: h.publicDetails } : {}),
        ...(h.totalEstimated ? { totalEstimated: true } : {}),
      } : {}),
      extras: extras.map(item => ({ name: item.name, cost: 0 })), nightly: 0, total: packagePricing(h.total, { ...s, extras }, commissions).total };
  }) };
}
