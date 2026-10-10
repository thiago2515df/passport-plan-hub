import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { decodeProposal } from "./hotels";

const codeSchema = z.string().regex(/^[a-z0-9]{6,12}$/);

/** Gera código curto aleatório (sem caracteres ambíguos). */
const newCode = () => {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  let c = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) c += abc[b % abc.length];
  return c;
};

/** Salva a proposta no banco e devolve um código curto para o link. */
export const saveProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ payload: z.string().min(1).max(200_000), code: codeSchema.optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./access.server");
    await assertPermission(context.supabase, "create_proposals");
    const proposal = decodeProposal(data.payload);
    if (!proposal) throw new Error("Proposta inválida.");
    const cost = z.number().finite().nonnegative();
    for (const hotel of proposal.hotels) cost.parse(hotel.total);
    if (proposal.s.transport?.price !== undefined) cost.parse(proposal.s.transport.price);
    z.array(z.object({ name: z.string().trim().min(1).max(120), cost })).parse(proposal.s.extras ?? []);
    if (proposal.s.adults !== undefined) z.number().int().nonnegative().parse(proposal.s.adults);
    z.array(z.number().int().min(0).max(17)).parse(proposal.s.childAges ?? []);
    if (proposal.s.transport?.mode && proposal.s.transport.mode !== "none") await assertPermission(context.supabase, "manage_transport");
    if (data.code) {
      const { data: saved, error } = await context.supabase.from("proposals").update({ payload: data.payload }).eq("code", data.code).select("code").maybeSingle();
      if (error || !saved) throw new Error("Proposta não encontrada ou edição não permitida.");
      return { code: saved.code };
    }
    for (let i = 0; i < 5; i++) {
      const code = newCode();
      const { error } = await context.supabase.from("proposals").insert({ code, payload: data.payload, owner_id: context.userId });
      if (!error) return { code };
      if (error.code !== "23505") throw new Error(error.message);
    }
    throw new Error("Não foi possível gerar o link. Tente de novo.");
  });

export const getEditableProposal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).inputValidator(data => codeSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { assertPermission } = await import("./access.server");
    await assertPermission(context.supabase, "create_proposals");
    const { data: row, error } = await context.supabase.from("proposals").select("code,payload,owner_id").eq("code", data).maybeSingle();
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !row || (!admin && row.owner_id !== context.userId)) throw new Error("Proposta não encontrada ou edição não permitida.");
    return { code: row.code, payload: row.payload, ownerId: row.owner_id };
  });

export const setProposalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(data => z.object({ code: codeSchema, status: z.enum(["created", "awaiting", "approved", "cancelled"]) }).parse(data))
  .handler(async ({ context, data }) => {
    const { assertPermission } = await import("./access.server");
    await assertPermission(context.supabase, "create_proposals");
    const { data: row, error } = await context.supabase.from("proposals").update({ status: data.status }).eq("code", data.code).select("code,status,sent_at").maybeSingle();
    if (error || !row) throw new Error("Não foi possível atualizar esta proposta.");
    return row;
  });

/** Busca uma proposta pelo código curto. */
export const getProposal = createServerFn({ method: "GET" })
  .inputValidator((data) => codeSchema.parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    const url = process.env['SUPABASE_URL'];
    if (!key || !url) throw new Error("Serviço indisponível.");
    const client = createClient(url, key, { auth: { persistSession: false }, global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } } });
    const { data: payload, error } = await client.rpc("public_proposal", { _code: data });
    if (error) throw new Error(error.message);
    return { payload: typeof payload === "string" ? payload : null };
  });
