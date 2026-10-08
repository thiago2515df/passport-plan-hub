import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const permissions = z.object({ search_hotels: z.boolean(), search_flights: z.boolean(), create_proposals: z.boolean(), manage_transport: z.boolean() });
const seller = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().max(30), email: z.string().email().max(200), permissions });

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
  const [people, rights, settings, activities, proposals] = await Promise.all([
    context.supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    context.supabase.from("seller_permissions").select("*"),
    context.supabase.from("system_settings").select("*").eq("id", 1).maybeSingle(),
    context.supabase.from("access_activity").select("*").order("created_at", { ascending: false }).limit(50),
    context.supabase.from("proposals").select("code,owner_id,created_at,payload").order("created_at", { ascending: false }).limit(200),
  ]);
  for (const result of [people, rights, settings, activities, proposals]) if (result.error) throw new Error("Não foi possível carregar as configurações.");
  return { people: people.data ?? [], rights: rights.data ?? [], settings: settings.data, activities: activities.data ?? [], proposals: proposals.data ?? [] };
});

export const createSeller = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(d => seller.extend({ password: z.string().min(10).max(128) }).parse(d))
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: false });
    if (error || !created.user) throw new Error("Não foi possível criar a conta. Verifique se o e-mail já está cadastrado.");
    const id = created.user.id;
    const results = await Promise.all([
      supabaseAdmin.from("profiles").update({ name: data.name, phone: data.phone }).eq("id", id),
      supabaseAdmin.from("user_roles").insert({ user_id: id, role: "seller" }),
      supabaseAdmin.from("seller_permissions").insert({ user_id: id, ...data.permissions }),
    ]);
    if (results.some(r => r.error)) { await supabaseAdmin.auth.admin.deleteUser(id); throw new Error("Não foi possível salvar o vendedor."); }
    await supabaseAdmin.from("access_activity").insert({ actor_id: context.userId, target_id: id, action: "Vendedor criado" });
    return { id };
  });

export const updateSeller = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(d => z.object({ id: z.string().uuid(), name: z.string().trim().min(2).max(100), phone: z.string().max(30), active: z.boolean(), permissions }).parse(d))
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const { data: targetAdmin } = await context.supabase.rpc("has_role", { _user_id: data.id, _role: "admin" });
    if (targetAdmin || data.id === context.userId) throw new Error("Este cadastro é de administrador e não pode ser alterado aqui.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.from("user_roles").select("user_id").eq("user_id", data.id).eq("role", "seller").maybeSingle();
    if (!target) throw new Error("Vendedor não encontrado.");
    const { error: p } = await supabaseAdmin.from("profiles").update({ name: data.name, phone: data.phone, active: data.active }).eq("id", data.id);
    const { error: r } = await supabaseAdmin.from("seller_permissions").upsert({ user_id: data.id, ...data.permissions });
    if (p || r) throw new Error("Não foi possível atualizar o vendedor.");
    await supabaseAdmin.from("access_activity").insert({ actor_id: context.userId, target_id: data.id, action: data.active ? "Cadastro e permissões atualizados" : "Acesso suspenso" });
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

export const listMyProposals = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: profile } = await context.supabase.from("profiles").select("active").eq("id", context.userId).maybeSingle();
  if (!profile?.active) throw new Error("Acesso suspenso.");
  const { data, error } = await context.supabase.from("proposals").select("code,payload,created_at").eq("owner_id", context.userId).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error("Não foi possível carregar suas propostas.");
  return data ?? [];
});