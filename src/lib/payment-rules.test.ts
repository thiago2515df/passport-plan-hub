import { describe, expect, it } from "vitest";
import {
  customerPackageTotal,
  DEFAULT_PAYMENT_RULES,
  installmentQuoteFromCustomerTotal,
  normalizePaymentRules,
  pixTotal,
} from "./payment-rules";

describe("parcelamento mostrado ao cliente", () => {
  it("mantém a tabela real da máquina de 1x a 12x", () => {
    expect(DEFAULT_PAYMENT_RULES.card.visaMaster).toEqual([
      3.89, 5.67, 6.51, 7.02, 7.90, 8.69, 9.48, 9.97, 11.02, 11.98, 12.90, 13.44,
    ]);
  });

  it("embute a taxa escolhida de 6x no preço oficial da proposta", () => {
    const customerTotal = customerPackageTotal(6000, DEFAULT_PAYMENT_RULES.card.visaMaster[5]!)!;
    expect(customerTotal).toBe(6571.02);
    const six = installmentQuoteFromCustomerTotal(
      customerTotal,
      6,
      DEFAULT_PAYMENT_RULES.card.visaMaster[5]!,
      DEFAULT_PAYMENT_RULES.card.visaMaster[5]!,
      6,
    )!;
    expect(six.total).toBe(6571.02);
    expect(six.installment).toBe(1095.17);
  });

  it("permite escolher 4x sem juros e embute a taxa de 4x", () => {
    const fee4x = DEFAULT_PAYMENT_RULES.card.visaMaster[3]!;
    expect(fee4x).toBe(7.02);
    const customerTotal = customerPackageTotal(3000, fee4x)!;
    expect(customerTotal).toBe(3226.5);
    const four = installmentQuoteFromCustomerTotal(customerTotal, 4, fee4x, fee4x, 4)!;
    expect(four.total).toBe(3226.5);
    expect(four.installment).toBeCloseTo(806.63, 2);
  });

  it("não aumenta o total dentro da faixa escolhida como sem juros", () => {
    const embedded = DEFAULT_PAYMENT_RULES.card.visaMaster[5]!;
    const customerTotal = customerPackageTotal(1000, embedded)!;
    for (let installments = 1; installments <= 6; installments++) {
      const quote = installmentQuoteFromCustomerTotal(
        customerTotal,
        installments,
        DEFAULT_PAYMENT_RULES.card.visaMaster[installments - 1]!,
        embedded,
        6,
      )!;
      expect(quote.total).toBe(customerTotal);
    }
  });

  it("acima da faixa sem juros substitui a taxa embutida pela taxa da parcela, sem duplicar", () => {
    const embedded = DEFAULT_PAYMENT_RULES.card.visaMaster[5]!;
    const customerTotal = customerPackageTotal(1000, embedded)!;
    const seven = installmentQuoteFromCustomerTotal(
      customerTotal,
      7,
      DEFAULT_PAYMENT_RULES.card.visaMaster[6]!,
      embedded,
      6,
    )!;
    expect(customerTotal).toBe(1095.17);
    expect(seven.total).toBeCloseTo(1104.73, 2);
    expect(seven.installment).toBeCloseTo(157.82, 2);
  });

  it("migra a configuração temporária que tinha zerado 1x a 6x", () => {
    const old = structuredClone(DEFAULT_PAYMENT_RULES);
    old.card.visaMaster = [0,0,0,0,0,0,9.48,9.97,11.02,11.98,12.90,13.44];
    old.card.otherBrands = [...old.card.visaMaster];
    const normalized = normalizePaymentRules(old);
    expect(normalized.card.visaMaster.slice(0, 6)).toEqual([3.89,5.67,6.51,7.02,7.90,8.69]);
  });

  it("aplica 8,90% de desconto no Pix sobre o preço final mostrado ao cliente", () => {
    expect(DEFAULT_PAYMENT_RULES.pix.discountPercent).toBe(8.9);
    expect(pixTotal(3263.77, 8.9)).toBe(2973.29);
    expect(pixTotal(6000, 8.9)).toBe(5466);
  });

  it("migra o antigo padrão de Pix sem desconto para 8,90%", () => {
    const old = structuredClone(DEFAULT_PAYMENT_RULES);
    old.pix = { enabled: true, discountPercent: 0, note: "Pagamento à vista via Pix." };
    const normalized = normalizePaymentRules(old);
    expect(normalized.pix.discountPercent).toBe(8.9);
    expect(normalized.pix.note).toBe("Pix à vista com desconto.");
  });

  it("usa regras padrão seguras para propostas antigas sem configuração", () => {
    expect(normalizePaymentRules(undefined)).toEqual(DEFAULT_PAYMENT_RULES);
  });

  it("rejeita taxas fora da faixa ao normalizar", () => {
    const invalid = structuredClone(DEFAULT_PAYMENT_RULES);
    invalid.card.visaMaster[6] = 99;
    expect(normalizePaymentRules(invalid)).toEqual(DEFAULT_PAYMENT_RULES);
  });
});
