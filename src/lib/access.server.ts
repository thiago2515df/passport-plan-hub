import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function assertAdmin(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso permitido somente ao administrador.");
}

export async function assertPermission(client: SupabaseClient<Database>, permission: string) {
  const { data, error } = await client.rpc("seller_can", { _permission: permission });
  if (error || !data) throw new Error("Seu acesso não permite esta operação.");
}

/** Check before importing/calling a paid supplier, including direct server requests. */
export async function assertSearchPermission(client: SupabaseClient<Database>, userId: string, permission: "search_hotels" | "search_flights") {
  const { assertSellerCommissions } = await import("./commissions.server");
  // The checks are independent; running them together removes one full
  // Supabase round-trip from the critical path without weakening authorization.
  await Promise.all([
    assertPermission(client, permission),
    assertSellerCommissions(client, userId),
  ]);
}
