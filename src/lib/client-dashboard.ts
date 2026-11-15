import { supabase } from "@/integrations/supabase/client";
import { acceptanceSchema } from "@/lib/proposal-acceptance";
import { commissionSettingsFromRow } from "@/lib/commission-rules";

export async function getAccessClient(userId: string) {
  const [profileRes, rolesRes] = await Promise.all([
    supabase.from("profiles").select("id,name,phone,email,active").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (rolesRes.error) throw rolesRes.error;
  const roles = new Set((rolesRes.data ?? []).map(row => row.role));
  return {
    profile: profileRes.data,
    admin: roles.has("admin"),
    allowed: roles.has("admin") || roles.has("seller"),
  };
}

export async function listMyProposalsClient() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Sessão inválida. Entre novamente.");

  const userId = authData.user.id;
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesError) throw rolesError;

  const admin = (roles ?? []).some(row => row.role === "admin");
  const seller = (roles ?? []).some(row => row.role === "seller");
  if (!admin && !seller) throw new Error("Acesso suspenso ou não autorizado.");

  let proposalQuery = supabase
    .from("proposals")
    .select("code,payload,created_at,owner_id,status,sent_at,updated_at")
    .order("created_at", { ascending: false });
  if (!admin) proposalQuery = proposalQuery.eq("owner_id", userId);

  const [proposalRes, peopleRes, commissionsRes, acceptanceRes] = await Promise.all([
    proposalQuery,
    supabase.from("profiles").select("id,name,email"),
    supabase.from("seller_commissions").select("*"),
    supabase.from("proposal_acceptances").select("*"),
  ]);

  if (proposalRes.error) throw new Error("Não foi possível carregar suas propostas.");
  if (peopleRes.error) throw new Error("Não foi possível carregar a equipe.");

  const commissionMap = new Map(
    (commissionsRes.data ?? []).map(row => [row.user_id, commissionSettingsFromRow(row)]),
  );
  const acceptances = acceptanceSchema.array().safeParse(acceptanceRes.data ?? []);
  const acceptanceRows = acceptances.success ? acceptances.data : [];

  return (proposalRes.data ?? []).map(row => {
    const rule = row.owner_id ? commissionMap.get(row.owner_id) : undefined;
    const person = peopleRes.data?.find(item => item.id === row.owner_id);
    return {
      ...row,
      acceptance: acceptanceRows.find(item => item.code === row.code) ?? null,
      commissions: rule?.configured ? rule : null,
      seller_name: person?.name || person?.email || "Cadastro anterior",
    };
  });
}

export async function getSettingsClient() {
  const [people, rights, settings, activities, proposals, commissions] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("seller_permissions").select("*"),
    supabase.from("system_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("access_activity").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("proposals").select("code,owner_id,created_at,payload").order("created_at", { ascending: false }).limit(200),
    supabase.from("seller_commissions").select("user_id,configured_at"),
  ]);

  if (people.error || rights.error) {
    throw new Error("Não foi possível consultar os vendedores.");
  }

  return {
    people: people.data ?? [],
    rights: rights.data ?? [],
    settings: settings.error ? null : settings.data,
    activities: activities.error ? [] : activities.data ?? [],
    proposals: proposals.error ? [] : proposals.data ?? [],
    commissions: (commissions.data ?? []).map(row => ({
      user_id: row.user_id,
      configured_at: row.configured_at,
    })),
    commissionIssue: null as null,
    warnings: [
      settings.error && "Não foi possível carregar os dados da agência.",
      activities.error && "Não foi possível carregar as atividades.",
      proposals.error && "Não foi possível carregar o histórico de propostas.",
    ].filter((value): value is string => !!value),
  };
}
