import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { decodeProposal, encodeProposal } from "./hotels";

const codeSchema = z.string().regex(/^[a-z0-9]{6,12}$/);
const EXTRA_MARKER = " __EBX__";

const splitExtraMarker = (room?: string) => {
  const value = room ?? "";
  const index = value.lastIndexOf(EXTRA_MARKER);
  if (index < 0) return { room: value, names: [] as string[] };
  const cleanRoom = value.slice(0, index);
  const encoded = value.slice(index + EXTRA_MARKER.length);
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded));
    const names = Array.isArray(parsed) ? parsed.map(String).map(v => v.trim()).filter(Boolean) : [];
    return { room: cleanRoom, names };
  } catch {
    return { room: value, names: [] as string[] };
  }
};

const payloadForStorage = (payload: string) => {
  const proposal = decodeProposal(payload);
  if (!proposal) return payload;
  const hotels = proposal.hotels.map(hotel => {
    const extras = hotel.extras ?? [];
    const names = extras.map(item => item.name.trim()).filter(Boolean);
    const extraCost = extras.reduce((sum, item) => sum + item.cost, 0);
    const cleanRoom = splitExtraMarker(hotel.room).room;
    const room = names.length ? `${cleanRoom}${EXTRA_MARKER}${encodeURIComponent(JSON.stringify(names))}` : cleanRoom;
    return { ...hotel, room, total: hotel.total + extraCost };
  });
  return encodeProposal({ s: { ...proposal.s, extras: [] }, hotels });
};

const payloadForEditing = (payload: string) => {
  const proposal = decodeProposal(payload);
  if (!proposal) return payload;
  const hotels = proposal.hotels.map(hotel => {
    const marker = splitExtraMarker(hotel.room);
    const extraCost = marker.names.length ? (hotel.extras ?? []).reduce((sum, item) => sum + item.cost, 0) : 0;
    return { ...hotel, room: marker.room, total: Math.max(0, hotel.total - extraCost) };
  });
  return encodeProposal({ s: proposal.s, hotels });
};

const payloadForPublicView = (payload: string) => {
  const proposal = decodeProposal(payload);
  if (!proposal) return payload;
  const hotels = proposal.hotels.map(hotel => {
    const marker = splitExtraMarker(hotel.room);
    const extras = marker.names.length ? marker.names.map(name => ({ name, cost: 0 })) : (hotel.extras ?? []);
    return { ...hotel, room: marker.room, extras };
  });
  return encodeProposal({ s: proposal.s, hotels });
};

export const acceptProposalPackage = createServerFn({ method: "POST" })
  .inputValidator(data => z.object({ code: codeSchema, hotelIndex: z.number().int().nonnegative(), total: z.number().finite().nonnegative() }).parse(data))
  .handler(async ({ data }) => {
    const { getProposalLifecycleState } = await import("./proposal-lifecycle.server");
    const lifecycle = await getProposalLifecycleState(data.code);
    if (lifecycle.state !== "active" && lifecycle.state !== "approved") {
      throw new Error("Esta proposta não está mais válida. Solicite uma nova proposta ao seu agente.");
    }

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
    const { data: ok, error } = await client.rpc("accept_proposal_package", { _code: data.code, _index: data.hotelIndex, _expected_total: data.total });
    if (error || !ok) throw new Error(error?.message ?? "Não foi possível confirmar o pacote.");
    return { ok: true };
  });

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
    const extraSchema = z.array(z.object({ name: z.string().trim().min(1).max(120), cost }));
    for (const hotel of proposal.hotels) {
      cost.parse(hotel.total);
      extraSchema.parse(hotel.extras ?? []);
    }
    if (proposal.s.transport?.price !== undefined) cost.parse(proposal.s.transport.price);
    extraSchema.parse(proposal.s.extras ?? []);
    if (proposal.s.adults !== undefined) z.number().int().nonnegative().parse(proposal.s.adults);
    z.array(z.number().int().min(0).max(17)).parse(proposal.s.childAges ?? []);
    if (proposal.s.transport?.mode && proposal.s.transport.mode !== "none") await assertPermission(context.supabase, "manage_transport");
    const storedPayload = payloadForStorage(data.payload);
    if (data.code) {
      const { data: saved, error } = await context.supabase.from("proposals").update({ payload: storedPayload }).eq("code", data.code).select("code").maybeSingle();
      if (error || !saved) throw new Error("Proposta não encontrada ou edição não permitida.");
      return { code: saved.code };
    }
    for (let i = 0; i < 5; i++) {
      const code = newCode();
      const { error } = await context.supabase.from("proposals").insert({ code, payload: storedPayload, owner_id: context.userId });
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
    return { code: row.code, payload: payloadForEditing(row.payload), ownerId: row.owner_id };
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
    const { getProposalLifecycleState } = await import("./proposal-lifecycle.server");
    const lifecycle = await getProposalLifecycleState(data);
    if (lifecycle.state === "missing" || lifecycle.state === "cancelled" || lifecycle.state === "expired") {
      return { payload: null, acceptance: null, state: lifecycle.state, expiresAt: lifecycle.expiresAt };
    }

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
    const { data: acceptance } = await client.rpc("proposal_acceptance_status", { _code: data });
    const parsed = z.object({ hotelIndex: z.number().int(), acceptedAt: z.string(), total: z.number() }).safeParse(acceptance);
    const publicPayload = typeof payload === "string" ? payloadForPublicView(payload) : null;
    return { payload: publicPayload, acceptance: parsed.success ? parsed.data : null, state: lifecycle.state, expiresAt: lifecycle.expiresAt };
  });
