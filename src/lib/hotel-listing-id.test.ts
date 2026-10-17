import { describe, expect, it } from "vitest";
import { airbnbListingId } from "./hotel-listing-id";

describe("public proposal hotel details", () => {
  it("does not crash when a public hotel has no internal offer ID", () => {
    expect(airbnbListingId({ provider: "hotel" })).toBe("");
    expect(airbnbListingId({})).toBe("");
  });

  it("uses the saved Airbnb provider listing ID without an internal offer ID", () => {
    expect(airbnbListingId({ provider: "airbnb", providerListingId: "1501379416546185177" }))
      .toBe("1501379416546185177");
  });

  it("also accepts an Airbnb-prefixed internal ID on the editing screen", () => {
    expect(airbnbListingId({ provider: "airbnb", id: "airbnb:1501379416546185177" }))
      .toBe("1501379416546185177");
  });

  it("does not send malformed listing IDs to the provider", () => {
    expect(airbnbListingId({ provider: "airbnb" })).toBe("");
    expect(airbnbListingId({ provider: "airbnb", id: "saved-0" })).toBe("");
    expect(airbnbListingId({ provider: "airbnb", providerListingId: "bad-ID" })).toBe("");
  });
});
