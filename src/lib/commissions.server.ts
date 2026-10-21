import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { emptyCommissions } from "./package-pricing";
import {
  commissionSettingsFromRow,
  requireConfiguredCommissions,
  type SellerCommissionSettings,
} from "./commission-rules";

export function isCommissionSchemaError(error: { code?: string; message?: string } | null) {
  return (
    !!error &&
    (["42703", "42P01", "PGRST204", "PGRST205"].includes(error.code ?? "") ||
      /(?:hotel_kind|hotel_value|configured_at|configured_by|seller_commissions).*(?:does not exist|schema cache)|(?:could not find).*(?:hotel_kind|hotel_value|configured_at|configured_by|seller_commissions)/i.test(
        error.message ?? "",
      ))
  );
}

export async function readCommissionOverview(client: SupabaseClient<Database>, userId?: string) {
  const query = (columns: string) => {
    const builder = client.from("seller_commissions").select(columns);
    return userId ? builder.eq("user_id", userId) : builder;
  };
  try {
    let result = await query(
      "user_id,air_kind,air_value,bus_kind,bus_value,hotel_kind,hotel_value,configured_at",
    );
    let issue: SellerCommissionSettings["issue"] = null;
    if (isCommissionSchemaError(result.error)) {
      // Read the legacy columns without assuming the migration has run. These
      // values can be displayed, but can never authorize a search or proposal.
      issue = "migration_required";
      result = await query("*");
    }
    if (result.error) return { records: [], issue: issue ?? ("unavailable" as const) };
    const rows = Array.isArray(result.data) ? result.data : [];
    const records = rows.map((value) => {
      const row = value as unknown as Record<string, unknown>;
      return {
        userId: String(row["user_id"] ?? userId ?? ""),
        settings: commissionSettingsFromRow(row),
      };
    });
    if (records.some((record) => record.settings.issue === "migration_required"))
      issue = "migration_required";
    return { records, issue };
  } catch {
    return { records: [], issue: "unavailable" as const };
  }
}

export async function readCommissionSettings(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<SellerCommissionSettings> {
  const overview = await readCommissionOverview(client, userId);
  const settings = overview.records.find((record) => record.userId === userId)?.settings ?? {
    ...emptyCommissions,
    configured: false,
    updatedAt: null,
  };
  return overview.issue
    ? { ...settings, configured: false, updatedAt: null, issue: overview.issue }
    : settings;
}

export async function assertSellerCommissions(
  client: SupabaseClient<Database>,
  userId: string,
  expectedUpdatedAt?: string,
) {
  return requireConfiguredCommissions(
    await readCommissionSettings(client, userId),
    expectedUpdatedAt,
  );
}
