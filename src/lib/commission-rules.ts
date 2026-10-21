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
};
export const COMMISSION_REQUIRED =
  "O administrador precisa cadastrar e confirmar suas comissões antes de liberar pesquisas e propostas.";
export const COMMISSION_CHANGED =
  "A comissão foi atualizada pelo administrador. Confira os novos valores no resumo e gere a proposta novamente.";

type CommissionRow = {
  air_kind: string;
  air_value: number;
  bus_kind: string;
  bus_value: number;
  hotel_kind: string;
  hotel_value: number;
  configured_at: string | null;
};

export function commissionSettingsFromRow(row: CommissionRow | null): SellerCommissionSettings {
  if (!row) return { ...emptyCommissions, configured: false, updatedAt: null };
  const commissions = commissionsSchema.parse({
    hotel: { kind: row.hotel_kind, value: Number(row.hotel_value) },
    air: { kind: row.air_kind, value: Number(row.air_value) },
    bus: { kind: row.bus_kind, value: Number(row.bus_value) },
  });
  return { ...commissions, configured: !!row.configured_at, updatedAt: row.configured_at };
}

export function requireConfiguredCommissions(
  settings: SellerCommissionSettings,
  expectedUpdatedAt?: string,
) {
  if (!settings.configured || !settings.updatedAt) throw new Error(COMMISSION_REQUIRED);
  if (expectedUpdatedAt !== undefined && settings.updatedAt !== expectedUpdatedAt)
    throw new Error(COMMISSION_CHANGED);
  return settings;
}
