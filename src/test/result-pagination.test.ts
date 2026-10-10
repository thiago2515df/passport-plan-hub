import { describe, expect, it } from "vitest";
import { paginateHotels } from "@/lib/result-pagination";

describe("hotel pagination", () => {
  it("shows ten hotels per page with no skipped or repeated results", () => {
    const hotels = Array.from({ length: 23 }, (_, id) => id);
    expect(paginateHotels(hotels, 1).items).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(paginateHotels(hotels, 2).items).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(paginateHotels(hotels, 3).items).toEqual([20, 21, 22]);
  });
  it("clamps the page after filtering results", () => {
    expect(paginateHotels([1, 2], 9)).toMatchObject({ page: 1, pages: 1, items: [1, 2] });
    expect(paginateHotels([], 1)).toMatchObject({ page: 1, start: 0, end: 0 });
  });
});