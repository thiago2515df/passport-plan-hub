import { describe, expect, it } from "vitest";
import { caldasBusCost, packagePricing, transportCost, type SellerCommissions } from "@/lib/package-pricing";
import { makeTransport, type Search } from "@/lib/hotels";
import { customerProposal } from "@/lib/customer-proposal";
const commissions: SellerCommissions = { air: { kind: "percent", value: 10 }, bus: { kind: "fixed", value: 150 } };
const s: Search = { destino: "Caldas Novas", checkin: "2027-01-10", checkout: "2027-01-12", hospedes: "2 hóspedes", adults: 2, rav: 12, telefone: "private", email: "private", childAges: [], transport: makeTransport("bus", "Caldas Novas"), extras: [{ name: "Transfer", cost: 80 }] };
describe("package selling prices", () => {
  it("charges R$110 per paying passenger and R$220 for two", () => { expect(caldasBusCost(1, [])).toBe(110); expect(caldasBusCost(2, [])).toBe(220); });
  it("excludes children aged five inclusive and younger", () => { expect(caldasBusCost(0, [0, 4, 5])).toBe(0); });
  it("includes children older than five", () => { expect(caldasBusCost(1, [5, 6])).toBe(220); });
  it("recalculates Caldas bus cost instead of trusting an entered amount", () => { expect(transportCost({ ...s, transport: { ...makeTransport("bus", s.destino), price: 999 } })).toBe(220); });
  it("adds fixed terrestrial commission to bus, hotel and extras", () => { expect(packagePricing(500, s, commissions)).toEqual({ cost: 800, commission: 150, total: 950 }); });
  it("adds air percentage on flights, hotel and extras", () => { const air = { ...s, transport: { ...makeTransport("air", s.destino), price: 1000 } }; expect(packagePricing(500, air, commissions)).toEqual({ cost: 1580, commission: 158, total: 1738 }); });
  it("updates the total when costs or commission change", () => { expect(packagePricing(600, s, commissions).total).toBe(1050); expect(packagePricing(500, s, { ...commissions, bus: { kind: "percent", value: 20 } }).total).toBe(960); });
  it("keeps each hotel as an alternative rather than summing alternatives", () => { expect([500, 800].map(cost => packagePricing(cost, s, commissions).total)).toEqual([950, 1250]); });
  it("projects only final prices and included items without internal costs or commission", () => {
    const safe = customerProposal({ s, hotels: [{ name: "Hotel", address: "", stars: 3, image: "", total: 500, nightly: 250 }] }, commissions);
    expect(safe.hotels[0]?.total).toBe(950);
    expect(safe.hotels[0]?.nightly).toBe(0);
    expect(safe.s.transport).not.toHaveProperty("price");
    expect(safe.s).not.toHaveProperty("telefone");
    expect(safe.s).not.toHaveProperty("email");
    expect(safe.s.extras).toEqual([{ name: "Transfer", cost: 0 }]);
    expect(safe).not.toHaveProperty("commissions");
    expect(safe.s.rav).toBe(0);
  });
});