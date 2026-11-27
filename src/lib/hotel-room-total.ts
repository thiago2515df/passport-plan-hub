import type { Hotel } from "./hotels";
type RoomQuote = Pick<Hotel, "provider" | "total" | "confirmedRoomCount">;
/** PassHub's totalPrice has no verified multi-room scope in the current contract. Never multiply it or treat alternatives as separate rooms. */
export function needsRoomTotalConfirmation(hotel: RoomQuote, rooms: number): boolean {
  return rooms > 1 && (!hotel.provider || hotel.provider === "hotel") &&
    (hotel.confirmedRoomCount !== rooms || !Number.isFinite(hotel.total) || hotel.total <= 0);
}
export function parseConfirmedRoomTotal(raw: string): number | null {
  const s = raw.trim().replace(/^R\$\s*/, "");
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}
