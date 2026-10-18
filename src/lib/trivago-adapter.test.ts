import { describe, expect, it } from "vitest";
import { applyTrivagoStayPrice, normalizeTrivagoItems } from "./trivago-adapter";
import type { TrivagoStay } from "./gecko-trivago.server";

const stay: TrivagoStay = {
  checkinDate: "2026-11-16", checkoutDate: "2026-11-18",
  numAdults: 2, numChildren: 0, numRooms: 1,
};
const hotel = normalizeTrivagoItems([{
  id: 125, namespace: 100, name: "Hotel de teste",
  url: "https://www.trivago.com.br/pt-BR/oar/hotel-teste?search=100-125",
  forecastedPrice: { amount: 8000, currency: "BRL" },
}], 2)[0]!;

describe("Trivago: menor preço publicado para a estadia, não PLP estimado", () => {
  it("does not treat the PLP forecast as a real supplier price", () => {
    expect(hotel.total).toBe(0);
    expect(hotel.priceConfirmed).toBe(false);
    expect(hotel.totalEstimated).toBe(true);
  });
  it("selects cheapest BRL supplier stay deal (not nightly, not forecast)", () => {
    const quoted = applyTrivagoStayPrice(hotel, {
      id: 125, currency: "BRL", ...stay,
      deals: [
        { advertiser: { name: "Booking" }, pricePerStay: { amount: 615.90, currency: "BRL" } },
        { advertiser: { name: "Agência B" }, pricePerStay: { amount: 399.80, currency: "BRL" }, roomCategory: "Quarto casal" },
        { advertiser: { name: "USD" }, pricePerStay: { amount: 100, currency: "USD" } },
      ],
    }, stay);
    expect(quoted?.supplierName).toBe("Agência B");
    expect(quoted?.total).toBe(399.80);
    expect(quoted?.nightly).toBe(199.90);
    expect(quoted?.room).toBe("Quarto casal");
    expect(quoted?.priceConfirmed).toBe(false);
    expect(quoted?.totalEstimated).toBe(true);
  });
  it("rejects missing totals, wrong occupancy, currency and dates", () => {
    const base = { id: 125, ...stay, currency: "BRL", deals: [{ pricePerStay: { amount: 200, currency: "BRL" } }] };
    expect(applyTrivagoStayPrice(hotel, { ...base, numAdults: 3 }, stay)).toBeNull();
    expect(applyTrivagoStayPrice(hotel, { ...base, checkoutDate: "2026-11-19" }, stay)).toBeNull();
    expect(applyTrivagoStayPrice(hotel, { ...base, currency: "USD" }, stay)).toBeNull();
    expect(applyTrivagoStayPrice(hotel, { ...base, deals: [] }, stay)).toBeNull();
  });
  it("accepts a scoped supplier quote even if optional echoed dates/guest fields are absent", () => {
    const r = applyTrivagoStayPrice(hotel, {
      id: 125,
      deals: [
        { advertiser: { name: "Fornecedor" }, pricePerStay: { amount: 420, currency: "BRL" } },
      ],
    }, stay);
    expect(r?.total).toBe(420);
    expect(r?.supplierName).toBe("Fornecedor");
    expect(r?.priceConfirmed).toBe(false);
  });
  it("does not trust external listing URLs", () => {
    expect(normalizeTrivagoItems([{ id: 1, url: "https://example.com/" }], 2)[0]?.sourceUrl).toBeUndefined();
  });
});
