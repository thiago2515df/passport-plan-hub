import { z } from "zod";
import { emptyCommissions, type SellerCommissions } from "./package-pricing";

const rule = z.object({
  kind: z.enum(["fixed", "percent"]),
  value: z.number().finite().nonnegative(),
});
export const commissionsSchema = z.object({ hotel: rule, air: rule, bus: rule });
export type SellerCommissionSettings = SellerCommissions & {
  configured: boolean;
  updatedAt: string | null;
  issue?: "migration_required" | "invalid_data" | "unavailable" | null;
};
export const COMMISSION_MIGRATION_REQUIRED =
  "A atualização das comissões no banco ainda não foi concluída. O administrador precisa concluir essa atualização para liberar pesquisas e propostas.";
export const COMMISSION_INVALID =
  "Há valores de comissão inválidos. O administrador precisa revisar e confirmar as três regras.";
export const COMMISSION_UNAVAILABLE =
  "Não foi possível consultar as comissões. Tente novamente; os cadastros continuam preservados.";
export const COMMISSION_REQUIRED =
  "O administrador precisa cadastrar e confirmar suas comissões antes de liberar pesquisas e propostas.";
export const COMMISSION_CHANGED =
  "A comissão foi atualizada pelo administrador. Confira os novos valores no resumo e gere a proposta novamente.";

export function commissionSettingsFromRow(row: unknown): SellerCommissionSettings {
  if (!row) return { ...emptyCommissions, configured: false, updatedAt: null };
  const parsed = z.record(z.unknown()).safeParse(row);
  if (!parsed.success)
    return { ...emptyCommissions, configured: false, updatedAt: null, issue: "invalid_data" };
  const record = parsed.data;
  const rules = (["hotel", "air", "bus"] as const).map((key) => {
    const value = record[`${key}_value`];
    return rule.safeParse({
      kind: record[`${key}_kind`],
      value:
        typeof value === "number" || (typeof value === "string" && value.trim())
          ? Number(value)
          : NaN,
    });
  });
  const [hotel, air, bus] = rules;
  const schemaReady = ["hotel_kind", "hotel_value", "configured_at"].every((key) => key in record);
  const timestamp = z
    .string()
    .datetime({ offset: true })
    .nullable()
    .safeParse(record["configured_at"]);
  const valid = rules.every((result) => result.success) && timestamp.success;
  const updatedAt = valid && timestamp.success ? timestamp.data : null;
  return {
    hotel: hotel?.success ? hotel.data : emptyCommissions.hotel,
    air: air?.success ? air.data : emptyCommissions.air,
    bus: bus?.success ? bus.data : emptyCommissions.bus,
    configured: schemaReady && valid && !!updatedAt,
    updatedAt,
    issue: !schemaReady ? "migration_required" : !valid ? "invalid_data" : null,
  };
}

export function requireConfiguredCommissions(
  settings: SellerCommissionSettings,
  expectedUpdatedAt?: string,
) {
  if (settings.issue === "migration_required") throw new Error(COMMISSION_MIGRATION_REQUIRED);
  if (settings.issue === "invalid_data") throw new Error(COMMISSION_INVALID);
  if (settings.issue === "unavailable") throw new Error(COMMISSION_UNAVAILABLE);
  if (!settings.configured || !settings.updatedAt) throw new Error(COMMISSION_REQUIRED);
  if (expectedUpdatedAt !== undefined && settings.updatedAt !== expectedUpdatedAt)
    throw new Error(COMMISSION_CHANGED);
  return settings;
}
