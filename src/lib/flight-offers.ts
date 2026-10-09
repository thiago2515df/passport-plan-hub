import type { Flight } from "./hotels";

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

export function mapFlightOffer(o: FlightOffer, index: number, from: string, to: string): Flight {
  const carryOn = typeof o.carryOnBaggageIncluded === "boolean" ? o.carryOnBaggageIncluded : undefined;
  const checked = typeof o.checkedBaggageIncluded === "boolean" ? o.checkedBaggageIncluded : undefined;
  return {
    id: o.offerId ?? `${index}-${o.flightNumber ?? ""}-${o.departureTime ?? ""}`,
    airline: o.airline ?? "", flightNumber: o.flightNumber ?? "", from: o.departureLocation ?? from, to: o.arrivalLocation ?? to,
    departure: (o.departureTime ?? "").slice(11, 16), arrival: (o.arrivalTime ?? "").slice(11, 16),
    ...(o.departureTime ? { departureDate: o.departureTime.slice(0, 10) } : {}),
    ...(o.arrivalTime ? { arrivalDate: o.arrivalTime.slice(0, 10) } : {}),
    duration: (o.totalFlightDuration ?? "").replace(":", "h"),
    stops: o.stopCount === undefined ? "Paradas não informadas" : o.stopCount ? `${o.stopCount} parada${o.stopCount > 1 ? "s" : ""}` : "Direto",
    connections: connectionCodes(o.stops), price: o.totalPrice, travelClass: o.serviceClass ?? "", ...(o.fareFamily ? { fareCategory: o.fareFamily } : {}),
    baggage: { ...(carryOn !== undefined ? { carryOn } : {}), ...(checked !== undefined ? { checked } : {}) },
    bags: checked ? `${o.checkedBaggageQuantity || 1} mala despachada` : carryOn ? "Bagagem de mão incluída" : "Consulte a franquia de bagagem",
  };
}