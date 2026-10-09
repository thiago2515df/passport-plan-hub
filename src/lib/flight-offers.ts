import type { Flight, FlightConnection } from "./hotels";

export type FlightOffer = {
  offerId?: string; airline?: string; flightNumber?: string; departureLocation?: string; arrivalLocation?: string;
  departureTime?: string; arrivalTime?: string; totalFlightDuration?: string; stopCount?: number; stops?: unknown;
  totalPrice: number; serviceClass?: string; fareFamily?: string; carryOnBaggageIncluded?: boolean | null;
  checkedBaggageIncluded?: boolean | null; checkedBaggageQuantity?: number;
};

function connectionCodes(stops: unknown): string[] {
  if (typeof stops === "string") return [...new Set(stops.match(/\b[A-Z]{3}\b/g) ?? [])];
  if (!Array.isArray(stops)) return [];
  return [...new Set(stops.flatMap(stop => {
    if (typeof stop === "string") return stop.match(/\b[A-Z]{3}\b/g) ?? [];
    if (!stop || typeof stop !== "object") return [];
    // Preserve only explicit airport codes, never guess airports from stop counts.
    return Object.entries(stop).flatMap(([key, value]) => /airport|iata|location/i.test(key) && typeof value === "string" && /^[A-Z]{3}$/.test(value) ? [value] : []);
  }))];
}

// Verified PassHub /v1/searches stops fields; preserve timestamps, never estimate them.
function connectionDetails(stops: unknown): FlightConnection[] {
  if (!Array.isArray(stops)) return [];
  return stops.flatMap(stop => {
    if (!stop || typeof stop !== "object") return [];
    const row = stop as Record<string, unknown>;
    if (typeof row['airportCode'] !== "string" || !/^[A-Z]{3}$/.test(row['airportCode'])) return [];
    const timestamp = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) ? v : undefined;
    return [{ airport: row['airportCode'],
      arrivalTime: timestamp(row['arrivalTime']), departureTime: timestamp(row['departureTime']),
      duration: typeof row['duration'] === "string" && row['duration'].trim() ? row['duration'] : undefined,
      nextDepartureAirport: typeof row['nextDepartureAirport'] === "string" && /^[A-Z]{3}$/.test(row['nextDepartureAirport']) ? row['nextDepartureAirport'] : undefined,
      isAirportChange: typeof row['isAirportChange'] === "boolean" ? row['isAirportChange'] : undefined,
    }];
  });
}

export function mapFlightOffer(o: FlightOffer, index: number, from: string, to: string): Flight {
  const carryOn = typeof o.carryOnBaggageIncluded === "boolean" ? o.carryOnBaggageIncluded : undefined;
  const checked = typeof o.checkedBaggageIncluded === "boolean" ? o.checkedBaggageIncluded : undefined;
  const details = connectionDetails(o.stops);
  return {
    id: o.offerId ?? `${index}-${o.flightNumber ?? ""}-${o.departureTime ?? ""}`,
    airline: o.airline ?? "", flightNumber: o.flightNumber ?? "", from: o.departureLocation ?? from, to: o.arrivalLocation ?? to,
    departure: (o.departureTime ?? "").slice(11, 16), arrival: (o.arrivalTime ?? "").slice(11, 16),
    ...(o.departureTime ? { departureDate: o.departureTime.slice(0, 10) } : {}),
    ...(o.arrivalTime ? { arrivalDate: o.arrivalTime.slice(0, 10) } : {}),
    duration: (o.totalFlightDuration ?? "").replace(":", "h"),
    stops: o.stopCount === undefined ? "Paradas não informadas" : o.stopCount ? `${o.stopCount} parada${o.stopCount > 1 ? "s" : ""}` : "Direto",
    connections: details.length ? details.map(c => c.airport) : connectionCodes(o.stops),
    ...(details.length ? { connectionDetails: details } : {}),
    price: o.totalPrice, travelClass: o.serviceClass ?? "", ...(o.fareFamily ? { fareCategory: o.fareFamily } : {}),
    baggage: { ...(carryOn !== undefined ? { carryOn } : {}), ...(checked !== undefined ? { checked } : {}) },
    bags: checked ? `${o.checkedBaggageQuantity || 1} mala despachada` : carryOn ? "Bagagem de mão incluída" : "Consulte a franquia de bagagem",
  };
}