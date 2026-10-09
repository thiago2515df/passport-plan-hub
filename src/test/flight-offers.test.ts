import { describe, expect, it } from "vitest";
import { mapFlightOffer } from "@/lib/flight-offers";
import { connectionAirportLabel, flightToTransportLeg } from "@/lib/customer-itinerary";
import { decodeProposal, encodeProposal } from "@/lib/hotels";

describe("real flight offer data", () => {
  it("imports verified PassHub stop timestamps and waiting time into customer proposal links", () => {
    const flight = mapFlightOffer({ totalPrice: 100, stopCount: 1,
      stops: [{ airportCode: "SSA", arrivalTime: "2027-01-15T23:05:00", departureTime: "2027-01-15T23:40:00", duration: "00h 35m", nextDepartureAirport: "SSA", isAirportChange: false }],
    }, 0, "BSB", "MCZ");
    expect(flight.connections).toEqual(["SSA"]);
    const leg = flightToTransportLeg(flight);
    const proposal = decodeProposal(encodeProposal({ s: { destino: "Maceió", checkin: "2027-01-15", checkout: "2027-01-20", hospedes: "2", rav: 0, transport: { mode: "air", outbound: leg, inbound: leg } }, hotels: [] }));
    expect(proposal?.s.transport?.outbound.connectionDetails).toEqual([{ airport: "SSA", arrivalTime: "2027-01-15T23:05:00", departureTime: "2027-01-15T23:40:00", duration: "00h 35m", nextDepartureAirport: "SSA", isAirportChange: false }]);
    expect(connectionAirportLabel("SSA")).toBe("Salvador (SSA)");
  });
  it("retains every ordered connection and airport change without inventing missing timestamps", () => {
    const flight = mapFlightOffer({ totalPrice: 100, stopCount: 2, stops: [
      { airportCode: "CGH", nextDepartureAirport: "GRU", isAirportChange: true },
      { airportCode: "SSA", arrivalTime: null, departureTime: "invalid" },
    ] }, 0, "BSB", "MCZ");
    expect(flight.connections).toEqual(["CGH", "SSA"]);
    expect(flight.connectionDetails?.[0]?.nextDepartureAirport).toBe("GRU");
    expect(flight.connectionDetails?.[0]?.isAirportChange).toBe(true);
    expect(flight.connectionDetails?.[1]?.arrivalTime).toBeUndefined();
    expect(flight.connectionDetails?.[1]?.departureTime).toBeUndefined();
    expect(flight.connectionDetails?.[1]?.duration).toBeUndefined();
    expect(connectionAirportLabel("XYZ")).toBe("XYZ");
  });
  it("preserves returned fare, dates, baggage and price rather than reference image values", () => {
    const flight = mapFlightOffer({ totalPrice: 676.78, fareFamily: "LIGHT", departureTime: "2027-02-12T23:10:00", arrivalTime: "2027-02-13T07:00:00", carryOnBaggageIncluded: true, checkedBaggageIncluded: false }, 0, "BSB", "GIG");
    expect(flight.price).toBe(676.78);
    expect(flight.fareCategory).toBe("LIGHT");
    expect(flight.departureDate).toBe("2027-02-12");
    expect(flight.arrivalDate).toBe("2027-02-13");
    expect(flight.baggage).toEqual({ carryOn: true, checked: false });
  });
  it("does not invent installments, commission, personal item allowance or fare rules", () => {
    const flight = mapFlightOffer({ totalPrice: 100 }, 0, "BSB", "GRU");
    expect(flight.installments).toBeUndefined();
    expect(flight.commission).toBeUndefined();
    expect(flight.baggage?.personal).toBeUndefined();
    expect(flight.baggage?.checked).toBeUndefined();
    expect(flight.fareRules).toBeUndefined();
  });
  it("extracts only returned connection airport codes", () => {
    expect(mapFlightOffer({ totalPrice: 100, stopCount: 1, stops: [{ airport: "VCP" }] }, 0, "BSB", "GIG").connections).toEqual(["VCP"]);
    expect(mapFlightOffer({ totalPrice: 100, stopCount: 1 }, 0, "BSB", "GIG").connections).toEqual([]);
  });
});