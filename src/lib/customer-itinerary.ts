import type { Flight, Search, TransportLeg } from "./hotels";

// Airport-city reference labels, not inferred from the departure/destination cities.
const airportCities: Record<string, string> = {
  SSA: "Salvador", BSB: "Brasília", GRU: "Guarulhos", CGH: "São Paulo", VCP: "Campinas",
  GIG: "Rio de Janeiro", SDU: "Rio de Janeiro", CNF: "Confins", REC: "Recife", FOR: "Fortaleza",
  MCZ: "Maceió", NAT: "São Gonçalo do Amarante", POA: "Porto Alegre", CWB: "São José dos Pinhais",
  FLN: "Florianópolis", GYN: "Goiânia", MAO: "Manaus", BEL: "Belém", JPA: "Bayeux",
  AJU: "Aracaju", BPS: "Porto Seguro", IGU: "Foz do Iguaçu", NVT: "Navegantes", CLV: "Caldas Novas",
};
export const connectionAirportLabel = (airport: string) => airportCities[airport] ? `${airportCities[airport]} (${airport})` : airport;

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