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
  .inputValidator((data) => z.object({ payload: z.string().min(1).max(200_000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./access.server");
    await assertPermission(context.supabase, "create_proposals");
    const proposal = decodeProposal(data.payload);
    if (!proposal) throw new Error("Proposta inválida.");
    if (proposal.s.transport?.mode && proposal.s.transport.mode !== "none") await assertPermission(context.supabase, "manage_transport");
    for (let i = 0; i < 5; i++) {
      const code = newCode();
      const { error } = await context.supabase.from("proposals").insert({ code, payload: data.payload, owner_id: context.userId });
      if (!error) return { code };
      if (error.code !== "23505") throw new Error(error.message);
    }
    throw new Error("Não foi possível gerar o link. Tente de novo.");
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
