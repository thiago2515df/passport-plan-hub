import { describe, expect, it } from "vitest";
import { calendarFirstMonth, calendarOpenMonth, defaultTravelDates, localCalendarDay } from "./travel-calendar-dates";

describe("calendário da busca de pacotes", () => {
  const october = new Date(2026, 9, 22, 9, 6);

  it("opens in October when the current month is October, on web and mobile", () => {
    const result = calendarOpenMonth(october);
    expect([result.getFullYear(), result.getMonth(), result.getDate()]).toEqual([2026, 9, 1]);
    expect(calendarFirstMonth(october).getMonth()).toBe(9);
  });

  it("defaults new trips to the current date instead of a fixed November date", () => {
    expect(defaultTravelDates(october)).toEqual({ checkin: "2026-10-22", checkout: "2026-10-24" });
  });

  it("keeps October 31 available with checkout crossing to November", () => {
    expect(defaultTravelDates(new Date(2026, 9, 31))).toEqual({ checkin: "2026-10-31", checkout: "2026-11-02" });
  });

  it("handles December to January without constructing an invalid date", () => {
    expect(defaultTravelDates(new Date(2026, 11, 31))).toEqual({ checkin: "2026-12-31", checkout: "2027-01-02" });
  });

  it("restores the selected month only for an existing proposal being edited", () => {
    const editedMonth = calendarOpenMonth(october, "2026-11-16");
    expect([editedMonth.getFullYear(), editedMonth.getMonth()]).toEqual([2026, 10]);
    expect(calendarOpenMonth(october).getMonth()).toBe(9);
  });

  it("allows selecting today without comparing with the current hour", () => {
    expect(localCalendarDay(october).getHours()).toBe(0);
    expect(localCalendarDay(october).getDate()).toBe(22);
  });
});
