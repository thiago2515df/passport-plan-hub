import { describe, expect, it } from "vitest";
import { geckoAirbnbPrice, parseGeckoBrlTotal } from "./gecko-price";

describe("GeckoAPI Airbnb PLP monetary fields", () => {
  it("parses the stay price including fees in BRL", () => {
    expect(parseGeckoBrlTotal("R$ 1.596,80 no total, incluindo taxas")).toBe(1596.8);
  });

  it("prefers the stay total including fees", () => {
    expect(geckoAirbnbPrice({ currency: "BRL", currencyRaw: "R$", price: 298, totalPriceLabel: "R$ 650 no total, incluindo taxas" }, 2))
      .toEqual({ nightly: 298, total: 650, totalEstimated: false });
  });

  it("marks an estimated stay total when the API returns only nightly price", () => {
    expect(geckoAirbnbPrice({ currency: "BRL", price: 150 }, 3))
      .toEqual({ nightly: 150, total: 450, totalEstimated: true });
  });

  it("rejects missing or zero-priced listings", () => {
    expect(geckoAirbnbPrice({ currency: "BRL" }, 2)).toBeNull();
    expect(geckoAirbnbPrice({ price: 0 }, 2)).toBeNull();
  });

  it("rejects non-BRL currencies to prevent misleading quotes", () => {
    expect(geckoAirbnbPrice({ currency: "USD", price: 200 }, 2)).toBeNull();
  });

  it("rejects zero-night stays", () => {
    expect(geckoAirbnbPrice({ currency: "BRL", price: 200 }, 0)).toBeNull();
  });
});
