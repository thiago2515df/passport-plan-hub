import { describe, expect, it } from "vitest";
import { normalizeTrivagoItems } from "./trivago-adapter";

describe("Trivago advertised-price normalization", () => {
  const hotel = (id: number, amount: number, currency = "BRL") => ({
    id, namespace: 100, name: "Hotel " + id, forecastedPrice: { amount, currency, arrival: "2026-11" },
  });
  it("sorts from cheapest to most expensive and marks all amounts unconfirmed", () => {
    const r = normalizeTrivagoItems([hotel(5, 300), hotel(6, 100)], 2);
    expect(r.map(h => h.total)).toEqual([200, 600]);
    expect(r.every(h => h.totalEstimated && h.priceConfirmed === false)).toBe(true);
  });
  it("omits non-BRL and unavailable prices", () => {
    const r = normalizeTrivagoItems([hotel(1, 10, "USD"), hotel(2, 0), hotel(3, 15)], 1);
    expect(r.map(h => h.id)).toEqual(["trivago:100:3"]);
  });
  it("rejects external URLs instead of exposing a link", () => {
    const r = normalizeTrivagoItems([{ ...hotel(2, 100), url: "https://example.org/" }], 1);
    expect(r[0]?.sourceUrl).toBeUndefined();
  });
});
