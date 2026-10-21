import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { commissionSettingsFromRow, requireConfiguredCommissions } from "./commission-rules";

export async function readCommissionSettings(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client
    .from("seller_commissions")
    .select("air_kind,air_value,bus_kind,bus_value,hotel_kind,hotel_value,configured_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error)
    throw new Error(
      "Não foi possível verificar as comissões. Solicite ao administrador a atualização do sistema e tente novamente.",
    );
  return commissionSettingsFromRow(data);
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
