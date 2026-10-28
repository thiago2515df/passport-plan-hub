import { z } from "zod";

export const percentSeries = z.array(z.number().finite().min(0).max(50)).length(12);
export const paymentRulesSchema = z.object({
  card: z.object({
    enabled: z.boolean(),
    visaMaster: percentSeries,
    otherBrands: percentSeries,
  }),
  pix: z.object({
    enabled: z.boolean(),
    discountPercent: z.number().finite().min(0).max(50),
    note: z.string().trim().max(160),
  }),
  boleto: z.object({
    enabled: z.boolean(),
    maxInstallments: z.number().int().min(1).max(12),
    fees: percentSeries,
    note: z.string().trim().max(160),
  }),
});
export type PaymentRules = z.infer<typeof paymentRulesSchema>;

export const DEFAULT_PAYMENT_RULES: PaymentRules = {
  card: {
    enabled: true,
    visaMaster: [3.89, 5.67, 6.51, 7.02, 7.90, 8.69, 9.48, 9.97, 11.02, 11.98, 12.90, 13.44],
    otherBrands: [4.50, 5.87, 6.57, 7.28, 7.98, 8.68, 9.58, 10.28, 11.02, 11.98, 12.90, 13.50],
  },
  pix: { enabled: true, discountPercent: 0, note: "Pagamento à vista via Pix." },
  boleto: { enabled: true, maxInstallments: 1, fees: [0,0,0,0,0,0,0,0,0,0,0,0], note: "Condições e vencimentos sujeitos à confirmação da agência." },
};

/** Gross-up keeps the package net amount after the configured provider fee. */
export const totalWithFee = (net: number, percent: number) => {
  if (!Number.isFinite(net) || net < 0 || !Number.isFinite(percent) || percent < 0 || percent >= 100) return null;
  return Math.round((net / (1 - percent / 100) + Number.EPSILON) * 100) / 100;
};
export const installmentQuote = (net: number, installments: number, percent: number) => {
  const total = totalWithFee(net, percent);
  if (total == null || !Number.isInteger(installments) || installments < 1 || installments > 12) return null;
  return { total, installment: Math.round((total / installments + Number.EPSILON) * 100) / 100 };
};
export const pixTotal = (net: number, discountPercent: number) =>
  Math.round((net * (1 - discountPercent / 100) + Number.EPSILON) * 100) / 100;

export function normalizePaymentRules(value: unknown): PaymentRules {
  const parsed = paymentRulesSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_PAYMENT_RULES;
}
