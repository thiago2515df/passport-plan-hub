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
    // 1x a 6x são sempre sem juros para o cliente.
    visaMaster: [0, 0, 0, 0, 0, 0, 9.48, 9.97, 11.02, 11.98, 12.90, 13.44],
    // Mantido somente para compatibilidade com propostas antigas. A interface não separa mais bandeiras.
    otherBrands: [0, 0, 0, 0, 0, 0, 9.48, 9.97, 11.02, 11.98, 12.90, 13.44],
  },
  pix: { enabled: true, discountPercent: 8.9, note: "Pix à vista com desconto." },
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
  let rules = parsed.success ? parsed.data : DEFAULT_PAYMENT_RULES;
  // Migra automaticamente propostas antigas que ainda carregam exatamente
  // o antigo padrão de Pix sem desconto. Regras já personalizadas continuam preservadas.
  if (rules.pix.enabled && rules.pix.discountPercent === 0 && rules.pix.note === "Pagamento à vista via Pix.") {
    rules = { ...rules, pix: { ...rules.pix, discountPercent: 8.9, note: "Pix à vista com desconto." } };
  }
  // Regra comercial atual: até 6x não pode receber acréscimo,
  // inclusive ao abrir propostas antigas que guardaram taxas nessa faixa.
  return {
    ...rules,
    card: {
      ...rules.card,
      visaMaster: rules.card.visaMaster.map((rate, index) => index < 6 ? 0 : rate),
      otherBrands: rules.card.otherBrands.map((rate, index) => index < 6 ? 0 : rate),
    },
  };
}
