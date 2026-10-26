import { describe, expect, it } from "vitest";
import { fullFlightPrice, replaceProposalFlight, restoreProposalFlights, savedFlightSnapshot } from "./proposal-edit-flights";
import type { Flight, Search } from "./hotels";
import { encodeProposal, decodeProposal } from "./hotels";
import { flightToTransportLeg } from "./customer-itinerary";

const flights: { out: Flight; back: Flight } = {
  out: { id: "g3-1", airline: "GOL", flightNumber: "G3 1234", from: "BSB", to: "SDU", departure: "09:05", arrival: "10:45", departureDate: "2026-11-23", arrivalDate: "2026-11-23", duration: "1h40", stops: "Direto", price: 850, travelClass: "LIGHT", bags: "mão" },
  back: { id: "ad-2", airline: "Azul", flightNumber: "AD 5458", from: "SDU", to: "BSB", departure: "17:05", arrival: "18:40", departureDate: "2026-11-28", arrivalDate: "2026-11-28", duration: "1h35", stops: "Direto", price: 940, travelClass: "Econômica", bags: "mão" },
};
const saved: Search = {
  destino: "Cabo Frio", checkin: "2026-11-23", checkout: "2026-11-28",
  origem: "Brasília", hospedes: "1 quarto · 2 hóspedes", rav: 0,
  transport: { mode: "air", outbound: flightToTransportLeg(flights.out), inbound: flightToTransportLeg(flights.back), price: 1790, travelClass: "Econômica", bags: "mão" },
};
describe("reabrir proposta com voos", () => {
  it("recupera voos de uma proposta antiga sem inventar preços separados", () => {
    const restored = restoreProposalFlights(saved);
    expect(restored.out?.flightNumber).toBe("G3 1234");
    expect(restored.back?.flightNumber).toBe("AD 5458");
    expect(restored.out?.departure).toBe("09:05");
    expect(restored.back?.arrival).toBe("18:40");
    expect(restored.out?.savedPriceUnavailable).toBe(true);
    expect(saved.transport?.price).toBe(1790);
    expect(savedFlightSnapshot(restored)).toBeUndefined();
  });
  it("recupera a seleção completa de propostas novas depois de salvar", () => {
    const roundtrip = decodeProposal(encodeProposal({ s: { ...saved, selectedFlights: flights }, hotels: [] }))!;
    expect(restoreProposalFlights(roundtrip.s)).toEqual(flights);
    expect(savedFlightSnapshot(flights)).toEqual(flights);
  });
  it("ao substituir um voo legado exige escolher também o outro trecho", () => {
    const restored = restoreProposalFlights(saved);
    const next = replaceProposalFlight(restored, "out", { ...flights.out, id: "new", price: 1200 });
    expect(next.out?.price).toBe(1200);
    expect(next.back).toBeUndefined();
    expect(fullFlightPrice(next)).toBe(1200);
  });
  it("ao substituir um voo novo mantém o preço do outro trecho", () => {
    const changed = replaceProposalFlight(flights, "out", { ...flights.out, price: 900 });
    expect(fullFlightPrice(changed)).toBe(1840);
    expect(savedFlightSnapshot(changed)?.back?.flightNumber).toBe("AD 5458");
  });
  it("preserva o transporte terrestre sem criar voo inexistente", () => {
    const bus: Search = { ...saved, transport: { ...saved.transport!, mode: "bus" } };
    expect(restoreProposalFlights(bus)).toEqual({});
  });
});
