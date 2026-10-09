import { describe, expect, it } from "vitest";
import { mapFlightOffer } from "@/lib/flight-offers";

describe("real flight offer data", () => {
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