import { describe, expect, it } from "vitest";
import { packagePricePerTraveler, proposalTravelerCount } from "./customer-package-price";

describe("Preço exibido na proposta pública", () => {
  it("exibe valor por pessoa e preserva total para quatro hóspedes", () => {
    const guests = proposalTravelerCount({
      roomOccupancies: [{ adults: 2, childAges: [] }, { adults: 2, childAges: [] }],
      adults: 4, childAges: [], hospedes: "2 quartos · 4 hóspedes",
    });
    expect(guests).toBe(4);
    expect(packagePricePerTraveler(10536, guests)).toBe(2634);
  });
  it("soma adultos e crianças da ocupação dos quartos sem multiplicar por quartos", () => {
    const guests = proposalTravelerCount({
      roomOccupancies: [
        { adults: 2, childAges: [6] },
        { adults: 2, childAges: [11] },
      ], adults: 4, childAges: [6, 11], hospedes: "2 quartos · 6 hóspedes",
    });
    expect(guests).toBe(6);
    expect(packagePricePerTraveler(12000, guests)).toBe(2000);
  });
  it("uses aggregate adults and children if room breakdown is missing", () => {
    expect(proposalTravelerCount({ adults: 3, childAges: [5], hospedes: "1 quarto · 4 hóspedes" })).toBe(4);
  });
  it("supports older proposals containing only a guest label", () => {
    expect(proposalTravelerCount({ hospedes: "1 quarto · 2 hóspedes" })).toBe(2);
    expect(proposalTravelerCount({ hospedes: "1 quarto · 1 hóspede" })).toBe(1);
    expect(proposalTravelerCount({ hospedes: "4 pessoas" })).toBe(4);
  });
  it("does not invent a per-person cost when the headcount is missing", () => {
    expect(proposalTravelerCount({ hospedes: "Sem hóspedes informados" })).toBeNull();
    expect(packagePricePerTraveler(1200, null)).toBeNull();
    expect(packagePricePerTraveler(1200, 0)).toBeNull();
  });
  it("rounds the illustrative equal share to cents", () => {
    expect(packagePricePerTraveler(100, 3)).toBe(33.33);
  });
});
