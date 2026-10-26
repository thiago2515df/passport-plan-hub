import type { Flight, Search, TransportLeg } from "./hotels";

type Direction = "out" | "back";
export type SelectedProposalFlights = { out?: Flight; back?: Flight };

/**
 * Older proposals saved flight timetable and baggage inside transport legs,
 * but did not save per-leg prices. Recover the factual itinerary without
 * inventing a per-leg fare from an aggregated transport total.
 */
export function flightFromSavedLeg(
  leg: TransportLeg | undefined,
  direction: Direction,
  date: string,
  travelClass = "",
  bags = "",
): Flight | undefined {
  if (!leg?.company?.trim() || !leg.departure?.trim() || !leg.arrival?.trim()) return undefined;
  const segments = leg.company.split(/\s*[·•]\s*/);
  const airline = leg.airline?.trim() || segments[0]?.trim() || leg.company.trim();
  const flightNumber = leg.flightNumber?.trim() || segments.slice(1).join(" · ").trim();
  return {
    id: `saved-${direction}-${flightNumber || airline}-${date}`,
    airline, flightNumber, from: leg.from || "", to: leg.to || "",
    departure: leg.departure, arrival: leg.arrival,
    duration: leg.duration || "", stops: leg.stops || "",
    price: 0, savedPriceUnavailable: true,
    travelClass: travelClass || leg.fareCategory || "", bags,
    ...(leg.departureDate || date ? { departureDate: leg.departureDate || date } : {}),
    ...(leg.arrivalDate || date ? { arrivalDate: leg.arrivalDate || date } : {}),
    fareCategory: leg.fareCategory,
    connections: leg.connections,
    connectionDetails: leg.connectionDetails,
    baggage: leg.baggage,
  };
}

export function restoreProposalFlights(s: Search): SelectedProposalFlights {
  if (s.transport?.mode !== "air") return {};
  return {
    out: s.selectedFlights?.out || flightFromSavedLeg(
      s.transport.outbound, "out", s.checkin, s.transport.travelClass, s.transport.bags),
    back: s.selectedFlights?.back || flightFromSavedLeg(
      s.transport.inbound, "back", s.checkout, s.transport.travelClass, s.transport.bags),
  };
}

export function savedFlightSnapshot(flights: SelectedProposalFlights): SelectedProposalFlights | undefined {
  const out = flights.out?.savedPriceUnavailable ? undefined : flights.out;
  const back = flights.back?.savedPriceUnavailable ? undefined : flights.back;
  return out && back ? { out: { ...out }, back: { ...back } } : undefined;
}

/** If replacing a legacy flight with no individual fare, the opposite leg
 * must also be reselected to avoid corrupting the original package total. */
export function replaceProposalFlight(
  current: SelectedProposalFlights, direction: Direction, flight: Flight,
): SelectedProposalFlights {
  const other = direction === "out" ? "back" : "out";
  return {
    [direction]: flight,
    ...(current[other] && !current[other]?.savedPriceUnavailable ? { [other]: current[other] } : {}),
  };
}

export const fullFlightPrice = (flights: SelectedProposalFlights): number =>
  (flights.out?.price ?? 0) + (flights.back?.price ?? 0);
