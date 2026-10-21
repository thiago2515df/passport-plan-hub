import { describe, expect, it } from "vitest";
import {
  commissionsSchema,
  commissionSettingsFromRow,
  requireConfiguredCommissions,
  COMMISSION_CHANGED,
  COMMISSION_REQUIRED,
  COMMISSION_MIGRATION_REQUIRED,
  COMMISSION_INVALID,
} from "@/lib/commission-rules";

const row = {
  hotel_kind: "percent",
  hotel_value: 20,
  air_kind: "fixed",
  air_value: 20,
  bus_kind: "percent",
  bus_value: 10,
  configured_at: "2026-10-21T17:00:00.123456+00:00",
};
describe("administrator confirmation of commissions", () => {
  it("blocks missing and legacy unconfirmed rules, preserving the existing amounts", () => {
    expect(() => requireConfiguredCommissions(commissionSettingsFromRow(null))).toThrow(
      COMMISSION_REQUIRED,
    );
    const old = commissionSettingsFromRow({ ...row, configured_at: null });
    expect(old.air).toEqual({ kind: "fixed", value: 20 });
    expect(() => requireConfiguredCommissions(old)).toThrow(COMMISSION_REQUIRED);
  });
  it("reads rows from the pre-hotel schema without throwing or treating them as confirmed", () => {
    const legacy = { air_kind: "fixed", air_value: 20, bus_kind: "percent", bus_value: 15 };
    const result = commissionSettingsFromRow(legacy);
    expect(result.air).toEqual({ kind: "fixed", value: 20 });
    expect(result.bus).toEqual({ kind: "percent", value: 15 });
    expect(result.issue).toBe("migration_required");
    expect(result.configured).toBe(false);
    expect(() => requireConfiguredCommissions(result)).toThrow(COMMISSION_MIGRATION_REQUIRED);
    expect(JSON.stringify(result)).not.toContain("NaN");
  });
  it("does not turn corrupt financial data or timestamps into a confirmed zero", () => {
    for (const invalid of [
      { ...row, hotel_value: null },
      { ...row, air_value: "broken" },
      { ...row, configured_at: "yesterday" },
    ]) {
      const result = commissionSettingsFromRow(invalid);
      expect(result.configured).toBe(false);
      expect(result.updatedAt).toBe(null);
      expect(result.issue).toBe("invalid_data");
      expect(() => requireConfiguredCommissions(result)).toThrow(COMMISSION_INVALID);
    }
  });
  it("allows zero only when explicitly confirmed", () => {
    const confirmed = commissionSettingsFromRow({
      ...row,
      hotel_value: 0,
      air_value: 0,
      bus_value: 0,
    });
    expect(requireConfiguredCommissions(confirmed)).toBe(confirmed);
  });
  it("requires another review after an administrator changes the rates", () => {
    const confirmed = commissionSettingsFromRow(row);
    expect(() => requireConfiguredCommissions(confirmed, "2026-10-20T17:00:00Z")).toThrow(
      COMMISSION_CHANGED,
    );
    expect(requireConfiguredCommissions(confirmed, row.configured_at).updatedAt).toBe(
      row.configured_at,
    );
  });
  it("validates all three rules and rejects invalid financial values", () => {
    const confirmed = commissionSettingsFromRow(row);
    expect(commissionsSchema.safeParse(confirmed).success).toBe(true);
    expect(commissionsSchema.safeParse({ air: confirmed.air, bus: confirmed.bus }).success).toBe(
      false,
    );
    for (const value of [-1, NaN, Infinity]) {
      expect(
        commissionsSchema.safeParse({ ...confirmed, hotel: { kind: "percent", value } }).success,
      ).toBe(false);
    }
  });
});
