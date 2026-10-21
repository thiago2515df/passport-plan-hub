import { describe, it, expect } from "vitest";
import { countAdults, allChildAges, countGuests, passhubRoomGroups, restoreRoomOccupancies } from "./room-occupancy";

describe("quartos por ocupação", () => {
  it("does not multiply total adults by number of rooms", () => {
    const rooms = [{ adults: 2, childAges: [] }, { adults: 2, childAges: [] }];
    expect(countAdults(rooms)).toBe(4);
    expect(countGuests(rooms)).toBe(4);
    expect(passhubRoomGroups(rooms)).toEqual([{ adults: 2, childAges: [], quantity: 2 }]);
  });
  it("keeps distinct occupancy in a different API room entry", () => {
    const rooms = [
      { adults: 3, childAges: [] },
      { adults: 2, childAges: [4, 9] },
      { adults: 2, childAges: [] },
    ];
    expect(passhubRoomGroups(rooms)).toEqual([
      { adults: 3, childAges: [], quantity: 1 },
      { adults: 2, childAges: [4, 9], quantity: 1 },
      { adults: 2, childAges: [], quantity: 1 },
    ]);
    expect(countAdults(rooms)).toBe(7);
    expect(allChildAges(rooms)).toEqual([4, 9]);
  });
  it("groups same rooms despite reversed child-age order", () => {
    expect(passhubRoomGroups([
      { adults: 2, childAges: [10, 6] },
      { adults: 2, childAges: [6, 10] },
    ])).toEqual([{ adults: 2, childAges: [6, 10], quantity: 2 }]);
  });
  it("restores already-saved room occupancy unchanged", () => {
    const saved = [{ adults: 3, childAges: [5] }, { adults: 1, childAges: [] }];
    expect(restoreRoomOccupancies(saved, 9, 9, [])).toEqual(saved);
  });
  it("redistributes old aggregate totals without duplicating adults", () => {
    const r = restoreRoomOccupancies(undefined, 2, 4, [8]);
    expect(r).toEqual([{ adults: 2, childAges: [8] }, { adults: 2, childAges: [] }]);
  });
});
