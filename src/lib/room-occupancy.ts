/** Number of guests assigned to each physical hotel room. */
export type RoomOccupancy = { adults: number; childAges: number[] };

export const defaultRoom = (): RoomOccupancy => ({ adults: 2, childAges: [] });

export const countAdults = (rooms: RoomOccupancy[]) => rooms.reduce((n, r) => n + r.adults, 0);
export const allChildAges = (rooms: RoomOccupancy[]) => rooms.flatMap(r => r.childAges);
export const countGuests = (rooms: RoomOccupancy[]) => countAdults(rooms) + allChildAges(rooms).length;

/** Same occupancy can be grouped into quantity > 1 in the PassHub API. */
export function passhubRoomGroups(rooms: RoomOccupancy[]): (RoomOccupancy & { quantity: number })[] {
  const groups = new Map<string, RoomOccupancy & { quantity: number }>();
  for (const room of rooms) {
    const ages = [...room.childAges].sort((a, b) => a - b);
    const key = JSON.stringify([room.adults, ages]);
    const existing = groups.get(key);
    if (existing) existing.quantity += 1;
    else groups.set(key, { adults: room.adults, childAges: ages, quantity: 1 });
  }
  return [...groups.values()];
}

/** Old saved proposals had only aggregate counts. Preserve the total
 * without inventing additional adults for every room when reopened. */
export function restoreRoomOccupancies(
  stored: RoomOccupancy[] | undefined,
  roomCount: number,
  adults: number,
  ages: number[],
): RoomOccupancy[] {
  if (stored?.length) return stored.map(r => ({ adults: r.adults, childAges: [...r.childAges] }));
  const count = Math.max(1, Math.min(9, Math.floor(roomCount || 1)));
  const adultTotal = Math.max(count, Math.floor(adults || 2));
  const result: RoomOccupancy[] = Array.from({ length: count }, () => ({ adults: 1, childAges: [] }));
  for (let i = count; i < adultTotal; i++) result[i % count]!.adults += 1;
  ages.forEach((age, i) => result[i % count]!.childAges.push(age));
  return result;
}
