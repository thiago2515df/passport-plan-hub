import type { Search } from "./hotels";

/**
 * Number of travelers across ALL rooms. An occupancy is a room, not an extra
 * group of passengers; never multiply the aggregate adults by room count.
 */
export function proposalTravelerCount(search: Pick<Search, "roomOccupancies" | "adults" | "childAges" | "hospedes">): number | null {
  const roomOccupancies = search.roomOccupancies;
  if (Array.isArray(roomOccupancies) && roomOccupancies.length > 0 &&
      roomOccupancies.every(room => Number.isInteger(room.adults) && room.adults >= 1 &&
        Array.isArray(room.childAges) && room.childAges.every(age => Number.isInteger(age) && age >= 0 && age <= 17))) {
    return roomOccupancies.reduce((total, room) => total + room.adults + room.childAges.length, 0);
  }

  // The public summary already shows the saved guest count. Older proposals
  // can receive default adult fields during projection, so matching the shown
  // total prevents a contradictory per-person price.
  const count = search.hospedes?.match(/(\d+)\s*(?:h[oó]spedes?|pessoas?|viajantes?)/i)?.[1];
  const parsed = Number(count);
  if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;

  if (typeof search.adults === "number" && Number.isInteger(search.adults) && search.adults > 0) {
    return search.adults + (Array.isArray(search.childAges) ? search.childAges.length : 0);
  }
  return null;
}

/**
 * Informational equal share of the final package amount. It does not change
 * pricing for children or the amount due on approval.
 */
export function packagePricePerTraveler(total: number, travelers: number | null): number | null {
  if (!Number.isFinite(total) || total < 0 || !travelers || !Number.isSafeInteger(travelers) || travelers < 1) return null;
  return Math.round((total / travelers + Number.EPSILON) * 100) / 100;
}
