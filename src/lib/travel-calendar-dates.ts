/** Default search dates must follow the real current calendar month.
 * Never anchor the app to a fixed launch/demo date. Dates are local to
 * the user's device so October remains available throughout October. */
export const localCalendarDay = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

export const calendarFirstMonth = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth(), 1);

const toISO = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function defaultTravelDates(now = new Date(), stayNights = 2): { checkin: string; checkout: string } {
  const today = localCalendarDay(now);
  const checkout = new Date(today.getFullYear(), today.getMonth(), today.getDate() + stayNights);
  return { checkin: toISO(today), checkout: toISO(checkout) };
}

/** New search: show the current month, including remaining dates this month.
 * Existing saved proposals: show their previously chosen departure month. */
export function calendarOpenMonth(now = new Date(), editingCheckin?: string): Date {
  if (editingCheckin && /^\d{4}-\d{2}-\d{2}$/.test(editingCheckin)) {
    const date = new Date(`${editingCheckin}T12:00:00`);
    if (Number.isFinite(date.getTime())) return calendarFirstMonth(date);
  }
  return calendarFirstMonth(now);
}
