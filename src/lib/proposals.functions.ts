import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  .inputValidator((data) => z.object({ payload: z.string().min(1).max(200_000) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let i = 0; i < 5; i++) {
      const code = newCode();
      const { error } = await supabaseAdmin.from("proposals").insert({ code, payload: data.payload });
      if (!error) return { code };
      if (error.code !== "23505") throw new Error(error.message);
    }
    throw new Error("Não foi possível gerar o link. Tente de novo.");
  });

/** Busca uma proposta pelo código curto. */
export const getProposal = createServerFn({ method: "GET" })
  .inputValidator((data) => codeSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("proposals").select("payload").eq("code", data).maybeSingle();
    if (error) throw new Error(error.message);
    return { payload: (row?.payload as string | undefined) ?? null };
  });
