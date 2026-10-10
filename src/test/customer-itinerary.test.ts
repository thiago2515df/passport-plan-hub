import { describe, expect, it } from "vitest";
import { flightToTransportLeg, passengerCounts } from "@/lib/customer-itinerary";
import type { Search } from "@/lib/hotels";

const s: Search = { destino: "Rio", checkin: "2027-04-12", checkout: "2027-04-15", hospedes: "1 quarto · 2 hóspedes", rav: 0 };
describe("customer itinerary data", () => {
  it("counts two adults and no children", () => { expect(passengerCounts({ ...s, adults: 2, childAges: [] })).toEqual({ adults: 2, children: 0 }); });
  it("counts children separately when present", () => { expect(passengerCounts({ ...s, adults: 2, childAges: [7] })).toEqual({ adults: 2, children: 1 }); });
  it("keeps legacy guest counts", () => { expect(passengerCounts(s)).toEqual({ adults: 2, children: 0 }); });
  it("preserves supplied connection times without estimating missing times", () => {
    const flight = { id: "1", airline: "Gol", flightNumber: "G3", from: "BSB", to: "GIG", departure: "12:35", arrival: "16:25", duration: "03h50", stops: "1 parada", travelClass: "", bags: "", price: 100, connections: ["SSA"] };
    expect(flightToTransportLeg(flight).connectionDetails).toBeUndefined();
    const details = [{ airport: "SSA", arrivalTime: "2027-04-12T13:40:00", departureTime: "2027-04-12T15:10:00", duration: "1h30" }];
    expect(flightToTransportLeg({ ...flight, connectionDetails: details }).connectionDetails).toEqual(details);
  });
  it("preserves flight metadata but excludes commercial fields", () => {
    const leg = flightToTransportLeg({ id: "1", airline: "Gol", flightNumber: "G3 1409", from: "BSB", to: "GIG", departure: "12:35", arrival: "16:25", departureDate: "2027-04-12", arrivalDate: "2027-04-12", duration: "03h50", stops: "1 parada", connections: ["CGH"], travelClass: "Economy", fareCategory: "LIGHT", bags: "Mão", baggage: { carryOn: true, checked: false }, price: 676.78, commission: 30 });
    expect(leg.baggage).toEqual({ carryOn: true, checked: false });
    expect(leg.departureDate).toBe("2027-04-12");
    expect(leg.connections).toEqual(["CGH"]);
    expect(leg).not.toHaveProperty("price");
    expect(leg).not.toHaveProperty("commission");
  });
});