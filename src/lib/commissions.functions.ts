import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emptyCommissions, type SellerCommissions } from "@/lib/package-pricing";

const rule = z.object({ kind: z.enum(["fixed", "percent"]), value: z.number().finite().nonnegative() });
export const commissionsSchema = z.object({ air: rule, bus: rule });
export const getSellerCommissions = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator(data => z.object({ userId: z.string().uuid().optional() }).parse(data))
  .handler(async ({ context, data }): Promise<SellerCommissions> => {
    const { assertPermission } = await import("./access.server");
    await assertPermission(context.supabase, "create_proposals");
    const { data: row, error } = await context.supabase.from("seller_commissions").select("air_kind,air_value,bus_kind,bus_value").eq("user_id", data.userId ?? context.userId).maybeSingle();
    if (error) throw new Error("Não foi possível carregar as comissões.");
    return row ? commissionsSchema.parse({ air: { kind: row.air_kind, value: Number(row.air_value) }, bus: { kind: row.bus_kind, value: Number(row.bus_value) } }) : emptyCommissions;
  });
export const saveSellerCommissions = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(data => commissionsSchema.extend({ userId: z.string().uuid().optional() }).parse(data))
  .handler(async ({ context, data }) => {
    const { assertPermission, assertAdmin } = await import("./access.server");
    await assertPermission(context.supabase, "create_proposals");
    const userId = data.userId ?? context.userId;
    if (userId !== context.userId) await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("seller_commissions").upsert({ user_id: userId, air_kind: data.air.kind, air_value: data.air.value, bus_kind: data.bus.kind, bus_value: data.bus.value });
    if (error) throw new Error("Não foi possível salvar as comissões.");
    return { ok: true };
  });