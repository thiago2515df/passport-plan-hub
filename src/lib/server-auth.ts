import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { commissionSettingsFromRow } from "@/lib/commission-rules";

export async function authorizeServerToken(
  accessToken: string,
  permission?: "search_hotels" | "search_flights" | "create_proposals" | "manage_transport",
) {
  const url = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim();
  if (!url || !key) throw new Error("Supabase não configurado no servidor.");

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Sessão expirada. Entre novamente.");
  const user = await response.json() as { id?: string };
  if (!user.id) throw new Error("Sessão inválida.");

  const [{ data: profile }, { data: roles }, { data: rights }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id,active").eq("id", user.id).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id),
    supabaseAdmin.from("seller_permissions").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!profile?.active) throw new Error("Seu acesso está suspenso.");
  const admin = (roles ?? []).some(row => row.role === "admin");
  const seller = (roles ?? []).some(row => row.role === "seller");
  if (!admin && !seller) throw new Error("Seu acesso não está liberado.");

  if (permission && !admin) {
    if (!seller || !rights?.[permission]) throw new Error("Seu acesso não permite esta operação.");
  }

  if (permission === "search_hotels" || permission === "search_flights") {
    const { data: commission } = await supabaseAdmin
      .from("seller_commissions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    const settings = commissionSettingsFromRow(commission);
    if (!settings.configured || settings.issue) {
      throw new Error("O administrador precisa cadastrar e confirmar suas comissões antes de liberar pesquisas e propostas.");
    }
  }
  return { userId: user.id, admin };
}
