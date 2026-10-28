import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { commissionsSchema, COMMISSION_MIGRATION_REQUIRED, COMMISSION_UNAVAILABLE } from "@/lib/commission-rules";
import { acceptanceSchema } from "@/lib/proposal-acceptance";
import { paymentRulesSchema, DEFAULT_PAYMENT_RULES } from "@/lib/payment-rules";

const permissions = z.object({ search_hotels: z.boolean(), search_flights: z.boolean(), create_proposals: z.boolean(), manage_transport: z.boolean() });
const seller = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().max(30), email: z.string().email().max(200), permissions });
const setupRedirect = z.string().url().refine(value => {
  const url = new URL(value);
  return url.pathname === "/reset-password" && !url.search && !url.hash && ["https://propostabsb.excursaobrasilia.com.br", "https://passport-plan-hub.lovable.app", "https://id-preview--ddd66a00-5f11-4b98-aeb8-15d4f4b34f1b.lovable.app", "http://localhost:8080"].includes(url.origin);
}, "Endereço de ativação inválido.");

export const getAgencyContact = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  } } });
  const { data, error } = await client.rpc("agency_contact");
  if (error || !data || typeof data !== "object") return null;
  return { agency_name: typeof data.agency_name === "string" ? data.agency_name : "Excursão Brasília", whatsapp: typeof data.whatsapp === "string" && /^\d{10,15}$/.test(data.whatsapp) ? data.whatsapp : "5561992267062" };
});

export const getAccess = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: profile } = await context.supabase.from("profiles").select("id,name,phone,email,active").eq("id", context.userId).maybeSingle();
  const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  const { data: allowed } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "seller" });
  return { profile, admin: !!admin, allowed: !!(admin || allowed) };
});

export const getSettings = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { assertAdmin } = await import("./access.server");
  await assertAdmin(context.supabase, context.userId);
  const { readCommissionOverview } = await import("./commissions.server");
  const [people, rights, settings, activities, proposals, commissions] = await Promise.all([
    context.supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    context.supabase.from("seller_permissions").select("*"),
    context.supabase.from("system_settings").select("*").eq("id", 1).maybeSingle(),
    context.supabase.from("access_activity").select("*").order("created_at", { ascending: false }).limit(50),
    context.supabase.from("proposals").select("code,owner_id,created_at,payload").order("created_at", { ascending: false }).limit(200),
    readCommissionOverview(context.supabase),
  ]);
  if (people.error || rights.error) throw new Error("Não foi possível consultar os vendedores. Tente novamente para carregar os cadastros.");
  return {
    people: people.data ?? [], rights: rights.data ?? [],
    settings: settings.error ? null : settings.data,
    activities: activities.error ? [] : activities.data ?? [],
    proposals: proposals.error ? [] : proposals.data ?? [],
    commissions: commissions.records.map(record => ({ user_id: record.userId, configured_at: record.settings.configured ? record.settings.updatedAt : null })),
    commissionIssue: commissions.issue,
    warnings: [settings.error && "Não foi possível carregar os dados da agência.", activities.error && "Não foi possível carregar as atividades.", proposals.error && "Não foi possível carregar o histórico de propostas."].filter((value): value is string => !!value),
  };
});

const password = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72).optional().or(z.literal("").transform(() => undefined));

export const createSeller = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(d => seller.extend({ redirectTo: setupRedirect, password, commissions: commissionsSchema }).parse(d))
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const { readCommissionSettings } = await import("./commissions.server");
    const commissionStorage = await readCommissionSettings(context.supabase, context.userId);
    if (commissionStorage.issue === "migration_required") throw new Error(COMMISSION_MIGRATION_REQUIRED);
    if (commissionStorage.issue === "unavailable") throw new Error(COMMISSION_UNAVAILABLE);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser(data.password ? { email: data.email, password: data.password, email_confirm: true } : { email: data.email, email_confirm: false });
    if (error || !created.user) throw new Error("Não foi possível criar a conta. Verifique se o e-mail já está cadastrado.");
    const id = created.user.id;
    const results = await Promise.all([
      supabaseAdmin.from("profiles").update({ name: data.name, phone: data.phone, active: true }).eq("id", id),
      supabaseAdmin.from("user_roles").insert({ user_id: id, role: "seller" }),
      supabaseAdmin.from("seller_permissions").insert({ user_id: id, ...data.permissions }),
      context.supabase.from("seller_commissions").insert({ user_id: id, hotel_kind: data.commissions.hotel.kind, hotel_value: data.commissions.hotel.value, air_kind: data.commissions.air.kind, air_value: data.commissions.air.value, bus_kind: data.commissions.bus.kind, bus_value: data.commissions.bus.value }),
    ]);
    if (results.some(r => r.error)) { await supabaseAdmin.auth.admin.deleteUser(id); throw new Error("Não foi possível salvar o vendedor."); }
    if (!data.password) {
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: data.redirectTo });
      if (inviteError) { await supabaseAdmin.auth.admin.deleteUser(id); throw new Error("Não foi possível enviar o convite. Tente criar a conta novamente."); }
    }
    await supabaseAdmin.from("access_activity").insert({ actor_id: context.userId, target_id: id, action: data.password ? "Vendedor criado com senha definida pelo administrador" : "Vendedor criado" });
    return { id, invited: !data.password };
  });

export const updateSeller = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ id: z.string().uuid(), name: z.string().trim().min(2).max(100), phone: z.string().max(30), active: z.boolean(), permissions, password }).parse(d))
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const { data: targetAdmin } = await context.supabase.rpc("has_role", { _user_id: data.id, _role: "admin" });
    if (targetAdmin || data.id === context.userId) throw new Error("Este cadastro é de administrador e não pode ser alterado aqui.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.from("user_roles").select("user_id").eq("user_id", data.id).eq("role", "seller").maybeSingle();
    if (!target) throw new Error("Vendedor não encontrado.");
    if (data.password) {
      const { error: pw } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password: data.password, email_confirm: true });
      if (pw) throw new Error("Não foi possível definir a senha. Tente uma senha mais forte.");
    }
    const { error: p } = await supabaseAdmin.from("profiles").update({ name: data.name, phone: data.phone, active: data.active }).eq("id", data.id);
    const { error: r } = await supabaseAdmin.from("seller_permissions").upsert({ user_id: data.id, ...data.permissions });
    if (p || r) throw new Error("Não foi possível atualizar o vendedor.");
    await supabaseAdmin.from("access_activity").insert({ actor_id: context.userId, target_id: data.id, action: data.password ? "Senha definida e acesso liberado pelo administrador" : data.active ? "Cadastro e permissões atualizados" : "Acesso suspenso" });
    return { ok: true };
  });

export const deleteSeller = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const { data: targetAdmin } = await context.supabase.rpc("has_role", { _user_id: data.id, _role: "admin" });
    if (targetAdmin || data.id === context.userId) throw new Error("Administradores não podem ser excluídos aqui.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.from("user_roles").select("user_id").eq("user_id", data.id).eq("role", "seller").maybeSingle();
    if (!target) throw new Error("Vendedor não encontrado.");
    await supabaseAdmin.from("seller_permissions").delete().eq("user_id", data.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error("Não foi possível excluir o vendedor.");
    await supabaseAdmin.from("access_activity").insert({ actor_id: context.userId, action: "Vendedor excluído" });
    return { ok: true };
  });

export const saveSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ agency_name: z.string().trim().min(2).max(100), whatsapp: z.string().regex(/^\d{10,15}$/) }).parse(d))
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("system_settings").upsert({ id: 1, ...data });
    if (error) throw new Error("Não foi possível salvar as configurações.");
    await supabaseAdmin.from("access_activity").insert({ actor_id: context.userId, action: "Dados da agência atualizados" });
    return { ok: true };
  });

export const savePaymentRules = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(data => paymentRulesSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizePaymentRules } = await import("./payment-rules");
    const normalized = normalizePaymentRules(data);
    const { error } = await supabaseAdmin.from("system_settings").upsert({ id: 1, payment_rules: normalized });
    if (error) throw new Error("Não foi possível salvar as formas de pagamento. Verifique se a migração 0010 foi aplicada.");
    await supabaseAdmin.from("access_activity").insert({ actor_id: context.userId, action: "Regras de pagamento atualizadas" });
    return { ok: true };
  });

export const getPaymentRules = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("system_settings").select("payment_rules").eq("id", 1).maybeSingle();
    if (error) return DEFAULT_PAYMENT_RULES;
    const { normalizePaymentRules } = await import("./payment-rules");
    return normalizePaymentRules(data?.payment_rules ?? DEFAULT_PAYMENT_RULES);
  });

export const listMyProposals = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { maintainProposalLifecycle } = await import("./proposal-lifecycle.server");
  await maintainProposalLifecycle();
  const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  const { data: seller } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "seller" });
  if (!admin && !seller) throw new Error("Acesso suspenso ou não autorizado.");
  let query = context.supabase.from("proposals").select("code,payload,created_at,owner_id,status,sent_at,updated_at").order("created_at", { ascending: false });
  if (!admin) query = query.eq("owner_id", context.userId);
  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar suas propostas.");
  const { data: people, error: peopleError } = await context.supabase.from("profiles").select("id,name,email");
  if (peopleError) throw new Error("Não foi possível carregar a equipe.");
  const { readCommissionOverview } = await import("./commissions.server");
  const commissions = await readCommissionOverview(context.supabase);
  const { data: acceptanceData, error: acceptanceError } = await context.supabase.rpc("my_proposal_acceptances");
  if (acceptanceError) throw new Error("Não foi possível carregar os pacotes aprovados.");
  const acceptances = z.array(acceptanceSchema).parse(acceptanceData ?? []);
  return (data ?? []).map(row => {
    const rule = commissions.records.find(item => item.userId === row.owner_id)?.settings;
    return { ...row, acceptance: acceptances.find(item => item.code === row.code) ?? null, commissions: !commissions.issue && rule?.configured ? rule : null, seller_name: people?.find(person => person.id === row.owner_id)?.name || people?.find(person => person.id === row.owner_id)?.email || "Cadastro anterior" };
  });
});
