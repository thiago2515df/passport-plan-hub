import { describe, expect, it } from "vitest";
import { sellerAirbnbUrl } from "./seller-airbnb-url";

const stay = { checkin: "2026-12-10", checkout: "2026-12-12", adults: 2 };

describe("Airbnb seller deep links", () => {
  it("opens the original listing with the selected dates and adults", () => {
    expect(sellerAirbnbUrl({ provider: "airbnb", providerListingId: "1312403531480296862" }, stay))
      .toBe("https://www.airbnb.com.br/rooms/1312403531480296862?check_in=2026-12-10&check_out=2026-12-12&adults=2");
  });
  it("accepts a validated Airbnb listing URL as fallback", () => {
    expect(sellerAirbnbUrl({
      provider: "airbnb",
      sourceUrl: "https://www.airbnb.com.br/rooms/1312403531480296862?adults=1",
    }, stay)).toContain("/rooms/1312403531480296862?");
  });
  it("never creates a seller link for a hotel", () => {
    expect(sellerAirbnbUrl({ provider: "hotel", providerListingId: "1312403531480296862" }, stay)).toBeNull();
  });
  it("rejects forged URLs and invalid stay periods", () => {
    expect(sellerAirbnbUrl({ provider: "airbnb", sourceUrl: "https://fake-airbnb.com/rooms/1312403531480296862" }, stay)).toBeNull();
    expect(sellerAirbnbUrl({ provider: "airbnb", providerListingId: "bad" }, stay)).toBeNull();
    expect(sellerAirbnbUrl({ provider: "airbnb", providerListingId: "1312403531480296862" }, { ...stay, checkout: "2026-12-09" })).toBeNull();
  });
});
