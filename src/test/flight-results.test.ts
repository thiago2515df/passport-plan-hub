import { describe, expect, it } from "vitest";
import { filterFlightResults } from "@/lib/flight-results";
import { mapFlightOffer } from "@/lib/flight-offers";

const flights = [
  mapFlightOffer({ offerId: "direct", totalPrice: 300, stopCount: 0 }, 0, "BSB", "GRU"),
  mapFlightOffer({ offerId: "connection", totalPrice: 200, stopCount: 1, stops: [{ airportCode: "SSA" }] }, 1, "BSB", "BPS"),
];
describe("flight result search", () => {
  it("searches airport names and codes without requiring accents", () => {
    expect(filterFlightResults(flights, "guarulhos", false, "asc").map(f => f.id)).toEqual(["direct"]);
    expect(filterFlightResults(flights, "GRU", false, "asc").map(f => f.id)).toEqual(["direct"]);
    expect(filterFlightResults(flights, "brasilia", false, "asc")).toHaveLength(2);
    expect(filterFlightResults(flights, "Salvador", false, "asc").map(f => f.id)).toEqual(["connection"]);
  });
  it("filters direct flights and orders actual prices without changing source results", () => {
    expect(filterFlightResults(flights, "", true, "asc").map(f => f.id)).toEqual(["direct"]);
    expect(filterFlightResults(flights, "", false, "asc").map(f => f.price)).toEqual([200, 300]);
    expect(filterFlightResults(flights, "", false, "desc").map(f => f.price)).toEqual([300, 200]);
    expect(flights.map(f => f.price)).toEqual([300, 200]);
  });
});