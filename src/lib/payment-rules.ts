import { z } from "zod";

export const percentSeries = z.array(z.number().finite().min(0).max(50)).length(12);
export const paymentRulesSchema = z.object({
  card: z.object({
    enabled: z.boolean(),
    embeddedFeePercent: z.number().finite().min(0).max(50).default(8.69),
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
    // Custo da adquirente em 6x. É embutido no preço do pacote antes da publicação.
    embeddedFeePercent: 8.69,
    // Taxa real da máquina por quantidade de parcelas. A proposta escolhe quantas
    // serão oferecidas "sem juros" e embute a taxa correspondente no preço final.
    visaMaster: [3.89, 5.67, 6.51, 7.02, 7.90, 8.69, 9.48, 9.97, 11.02, 11.98, 12.90, 13.44],
    // Mantido somente por compatibilidade. A proposta pública usa uma única tabela.
    otherBrands: [4.50, 5.87, 6.57, 7.28, 7.98, 8.68, 9.58, 10.28, 11.02, 11.98, 12.90, 13.50],
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

export const rateForInterestFreeInstallments = (rules: PaymentRules, installments: number) => {
  const count = Math.max(1, Math.min(12, Math.floor(installments || 6)));
  return rules.card.visaMaster[count - 1] ?? rules.card.embeddedFeePercent;
};

/** Final customer package price after embedding the 6x machine fee.
 * The agency keeps the original net amount after the provider deducts the fee. */
export const customerPackageTotal = (netPackageTotal: number, embeddedFeePercent: number) =>
  totalWithFee(netPackageTotal, embeddedFeePercent);

/** Public card quote when the proposal total already contains the 6x fee.
 * 1x–6x do not increase the public total. 7x–12x replace the embedded 6x
 * machine rate with the configured total rate for that installment count,
 * preventing double-charging the fee. */
export const installmentQuoteFromCustomerTotal = (
  customerTotal: number,
  installments: number,
  targetPercent: number,
  embeddedFeePercent: number,
  interestFreeInstallments = 6,
) => {
  if (!Number.isFinite(customerTotal) || customerTotal < 0 ||
      !Number.isInteger(installments) || installments < 1 || installments > 12 ||
      !Number.isFinite(embeddedFeePercent) || embeddedFeePercent < 0 || embeddedFeePercent >= 100) return null;
  const freeThrough = Math.max(1, Math.min(12, Math.floor(interestFreeInstallments || 6)));
  if (installments <= freeThrough) {
    return {
      total: Math.round((customerTotal + Number.EPSILON) * 100) / 100,
      installment: Math.round((customerTotal / installments + Number.EPSILON) * 100) / 100,
    };
  }
  const netBeforeMachineFee = Math.round((customerTotal * (1 - embeddedFeePercent / 100) + Number.EPSILON) * 100) / 100;
  return installmentQuote(netBeforeMachineFee, installments, targetPercent);
};

export function normalizePaymentRules(value: unknown): PaymentRules {
  const parsed = paymentRulesSchema.safeParse(value);
  let rules = parsed.success ? parsed.data : DEFAULT_PAYMENT_RULES;
  // Migra automaticamente propostas antigas que ainda carregam exatamente
  // o antigo padrão de Pix sem desconto. Regras já personalizadas continuam preservadas.
  if (rules.pix.enabled && rules.pix.discountPercent === 0 && rules.pix.note === "Pagamento à vista via Pix.") {
    rules = { ...rules, pix: { ...rules.pix, discountPercent: 8.9, note: "Pix à vista com desconto." } };
  }
  // Migra o padrão temporário que zerava 1x–6x. Essas são taxas reais da
  // máquina e agora precisam existir para que a proposta possa embuti-las.
  if (rules.card.visaMaster.slice(0, 6).every(rate => rate === 0)) {
    const restored = [3.89, 5.67, 6.51, 7.02, 7.90, 8.69, ...rules.card.visaMaster.slice(6)];
    rules = { ...rules, card: { ...rules.card, visaMaster: restored, otherBrands: [...restored] } };
  }
  return rules;
}
