import { isCaldasNovas, type Search } from "@/lib/hotels";

export type Commission = { kind: "fixed" | "percent"; value: number };
export type SellerCommissions = { air: Commission; bus: Commission };
export const emptyCommissions: SellerCommissions = { air: { kind: "fixed", value: 0 }, bus: { kind: "fixed", value: 0 } };
export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const caldasBusCost = (adults: number, childAges: number[]) => 110 * (adults + childAges.filter(age => age > 5).length);
export function transportCost(s: Search) {
  if (!s.transport || s.transport.mode === "none") return 0;
  if (s.transport.mode === "bus" && isCaldasNovas(s.destino)) {
    const children = s.childAges ?? [];
    const totalGuests = Number(s.hospedes.match(/(\d+)\s*hóspede/)?.[1] ?? s.hospedes.match(/^\d+$/)?.[0] ?? 2);
    return caldasBusCost(s.adults ?? Math.max(0, totalGuests - children.length), children);
  }
  return s.transport.price ?? 0;
}
export function packagePricing(hotelCost: number, s: Search, commissions: SellerCommissions = emptyCommissions) {
  const cost = money(hotelCost + transportCost(s) + (s.extras ?? []).reduce((sum, item) => sum + item.cost, 0));
  const rule = s.transport?.mode === "air" ? commissions.air : s.transport?.mode === "bus" ? commissions.bus : emptyCommissions.air;
  const commission = money(rule.kind === "percent" ? cost * rule.value / 100 : rule.value);
  return { cost, commission, total: money(cost + commission) };
}