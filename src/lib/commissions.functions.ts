import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COMMISSION_MIGRATION_REQUIRED, COMMISSION_UNAVAILABLE, commissionsSchema, type SellerCommissionSettings } from "./commission-rules";

export const getSellerCommissions = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator(data => z.object({ userId: z.string().uuid().optional() }).parse(data))
  .handler(async ({ context, data }): Promise<SellerCommissionSettings> => {
    const userId = data.userId ?? context.userId;
    if (userId !== context.userId) {
      const { assertAdmin } = await import("./access.server");
      await assertAdmin(context.supabase, context.userId);
    }
    const { readCommissionSettings } = await import("./commissions.server");
    return readCommissionSettings(context.supabase, userId);
  });
export const saveSellerCommissions = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(data => commissionsSchema.extend({ userId: z.string().uuid().optional() }).parse(data))
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./access.server");
    await assertAdmin(context.supabase, context.userId);
    const userId = data.userId ?? context.userId;
    const { readCommissionSettings, isCommissionSchemaError } = await import("./commissions.server");
    const current = await readCommissionSettings(context.supabase, userId);
    if (current.issue === "migration_required") throw new Error(COMMISSION_MIGRATION_REQUIRED);
    if (current.issue === "unavailable") throw new Error(COMMISSION_UNAVAILABLE);
    const { error } = await context.supabase.from("seller_commissions").upsert({ user_id: userId, hotel_kind: data.hotel.kind, hotel_value: data.hotel.value, air_kind: data.air.kind, air_value: data.air.value, bus_kind: data.bus.kind, bus_value: data.bus.value });
    if (isCommissionSchemaError(error)) throw new Error(COMMISSION_MIGRATION_REQUIRED);
    if (error) throw new Error("Não foi possível salvar as comissões.");
    return { ok: true };
  });
