import { packagePricing, type SellerCommissions } from "@/lib/package-pricing";
import { decodeProposal, type TransportLeg } from "@/lib/hotels";

/** Explicit public projection: never spread internal service or pricing data. */
export function customerProposal(p: NonNullable<ReturnType<typeof decodeProposal>>, commissions?: SellerCommissions) {
  const s = p.s;
  const leg = (v: TransportLeg): TransportLeg => ({ company: v.company, departure: v.departure, arrival: v.arrival, ticket: v.ticket, from: v.from, to: v.to, duration: v.duration, stops: v.stops, airline: v.airline, flightNumber: v.flightNumber, departureDate: v.departureDate, arrivalDate: v.arrivalDate, fareCategory: v.fareCategory, connections: v.connections, connectionDetails: v.connectionDetails, baggage: v.baggage });
  return { s: { destino: s.destino, checkin: s.checkin, checkout: s.checkout, hospedes: s.hospedes, cliente: s.cliente, origem: s.origem, rooms: s.rooms, adults: s.adults, childAges: s.childAges, rav: 0, extras: s.extras?.map(item => ({ name: item.name, cost: 0 })), ...(s.transport ? { transport: { mode: s.transport.mode, outbound: leg(s.transport.outbound), inbound: leg(s.transport.inbound), travelClass: s.transport.travelClass, bags: s.transport.bags } } : {}) }, hotels: p.hotels.map(h => ({ name: h.name, address: h.address, stars: h.stars, room: h.room, image: h.image, hotelId: h.hotelId, nightly: 0, total: packagePricing(h.total, s, commissions).total })) };
}