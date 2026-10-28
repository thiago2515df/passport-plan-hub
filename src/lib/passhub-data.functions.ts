import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** No keys or customer data ever cross the server function boundary. */
export const getPasshubDataStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const { passhubDataReadiness } = await import("./passhub-data.server");
    return passhubDataReadiness();
  });

/**
 * Verifies a documented GET resource with admin permission only.
 * Never echoes records, personal data, secret key, or raw upstream error bodies.
 */
export const verifyPasshubDataAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const { passhubDataReadiness, PASSHUB_DATA_RESOURCES, readPasshubData } =
      await import("./passhub-data.server");
    const readiness = passhubDataReadiness();
    if (!readiness.ready) return { connected: false, message: "Faltam as configurações do guia técnico da API de dados PassHub." };
    const resource = PASSHUB_DATA_RESOURCES.find(name => readiness.resources[name]);
    if (!resource) return { connected: false, message: "Nenhum endpoint de leitura configurado." };
    try {
      await readPasshubData(resource);
      return { connected: true, message: "Chave e endpoint responderam com sucesso. Nenhum dado pessoal foi exibido." };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : "Não foi possível testar a conexão." };
    }
  });
