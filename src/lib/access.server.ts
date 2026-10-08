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