import { describe, it, expect } from "vitest";
import { needsRoomTotalConfirmation, parseConfirmedRoomTotal } from "./hotel-room-total";
describe("multi-room total safety", () => {
  it("blocks unknown scope and old quotes, accepts explicitly confirmed combined total", () => {
    expect(needsRoomTotalConfirmation({total:1813.28},2)).toBe(true);
    expect(needsRoomTotalConfirmation({total:3626.56, confirmedRoomCount:2},2)).toBe(false);
    expect(needsRoomTotalConfirmation({total:3626.56, confirmedRoomCount:2},3)).toBe(true);
    expect(needsRoomTotalConfirmation({total:0, confirmedRoomCount:2},2)).toBe(true);
    expect(needsRoomTotalConfirmation({total:1813.28},1)).toBe(false);
    expect(needsRoomTotalConfirmation({total:1813.28,provider:"airbnb"},2)).toBe(false);
  });
  it("parses explicit BRL totals", () => {
    expect(parseConfirmedRoomTotal("R$ 3.626,56")).toBe(3626.56);
    expect(parseConfirmedRoomTotal("3626.56")).toBe(3626.56);
    expect(parseConfirmedRoomTotal("")).toBeNull();
  });
});
