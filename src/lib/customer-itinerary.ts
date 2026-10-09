import type { Flight, Search, TransportLeg } from "./hotels";

export function flightToTransportLeg(f: Flight): TransportLeg {
  return { company: `${f.airline} · ${f.flightNumber}`, airline: f.airline, flightNumber: f.flightNumber,
    departure: f.departure, arrival: f.arrival, from: f.from, to: f.to, duration: f.duration, stops: f.stops,
    departureDate: f.departureDate, arrivalDate: f.arrivalDate, fareCategory: f.fareCategory || f.travelClass,
    connections: f.connections, connectionDetails: f.connectionDetails, baggage: f.baggage };
}

export function passengerCounts(s: Search) {
  const children = s.childAges?.length ?? 0;
  const legacy = s.hospedes.match(/(\d+)\s*(?:h[oó]spedes?|pessoas?)/i)?.[1] ?? s.hospedes.match(/^\s*(\d+)\s*$/)?.[1];
  return { adults: s.adults ?? (legacy ? Math.max(0, Number(legacy) - children) : undefined), children };
}