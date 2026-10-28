import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const resourceSchema = z.enum(["air", "bus", "car", "hotel", "insurance", "payment_links", "users"]);
const idSchema = z.string().trim().regex(/^[a-zA-Z0-9_-]{1,128}$/);

export const getPasshubDataStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const { passhubDataReadiness } = await import("./passhub-data.server");
    return passhubDataReadiness();
  });

/** Connection check: executes a single read, never returns customer records. */
export const verifyPasshubDataAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const { passhubDataReadiness, listPasshubData } = await import("./passhub-data.server");
    if (!passhubDataReadiness().ready)
      return { connected: false, message: "Cadastre PASSHUB_DATA_API_KEY nos Secrets do Lovable." };
    try {
      await listPasshubData("users", 1, 1);
      return { connected: true, message: "Conexão validada. A API respondeu sem expor dados da agência." };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : "Falha ao validar conexão." };
    }
  });

/** No anonymous endpoint; server validates page, size and allowed resource. */
export const listPasshubAgencyRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(value => z.object({
    resource: resourceSchema,
    page: z.number().int().min(1).max(100000).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
  }).parse(value))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const { listPasshubData } = await import("./passhub-data.server");
    return await listPasshubData(data.resource, data.page, data.pageSize);
  });

export const getPasshubAgencyRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(value => z.object({
    resource: resourceSchema.exclude(["users"]),
    id: idSchema,
    paymentAttempts: z.boolean().default(false),
  }).parse(value))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const { detailPasshubData, linkPaymentsPasshubData } = await import("./passhub-data.server");
    return data.paymentAttempts && data.resource === "payment_links"
      ? await linkPaymentsPasshubData(data.id)
      : await detailPasshubData(data.resource, data.id);
  });
