import { describe, expect, it } from "vitest";
import { customerPackageTotal, DEFAULT_PAYMENT_RULES, installmentQuote, installmentQuoteFromCustomerTotal, normalizePaymentRules, pixTotal } from "./payment-rules";

describe("parcelamento mostrado ao cliente", () => {
  it("embute a taxa da máquina de 6x antes de publicar o pacote", () => {
    expect(DEFAULT_PAYMENT_RULES.card.embeddedFeePercent).toBe(8.69);
    const customerTotal = customerPackageTotal(6000, 8.69)!;
    expect(customerTotal).toBe(6571.02);
    const six = installmentQuoteFromCustomerTotal(customerTotal, 6, 0, 8.69)!;
    expect(six.total).toBe(6571.02);
    expect(six.installment).toBe(1095.17);
  });

  it("não cobra a taxa embutida novamente em 7x a 12x", () => {
    const customerTotal = customerPackageTotal(1000, 8.69)!;
    const seven = installmentQuoteFromCustomerTotal(customerTotal, 7, 9.48, 8.69)!;
    expect(customerTotal).toBe(1095.17);
    expect(seven.total).toBeCloseTo(1104.73, 2);
    expect(seven.installment).toBeCloseTo(157.82, 2);
  });
  it("mantém o valor total do pacote de 1x a 6x sem juros", () => {
    for (let installments = 1; installments <= 6; installments++) {
      const q = installmentQuote(600, installments, DEFAULT_PAYMENT_RULES.card.visaMaster[installments - 1]!)!;
      expect(q.total).toBe(600);
      expect(q.installment).toBeCloseTo(600 / installments, 2);
    }
  });

  it("aplica juros somente a partir de 7x", () => {
    expect(DEFAULT_PAYMENT_RULES.card.visaMaster.slice(0, 6)).toEqual([0,0,0,0,0,0]);
    expect(installmentQuote(1000, 7, DEFAULT_PAYMENT_RULES.card.visaMaster[6]!)?.installment).toBeCloseTo(157.82, 2);
    expect(installmentQuote(1000, 12, DEFAULT_PAYMENT_RULES.card.visaMaster[11]!)?.installment).toBeCloseTo(96.27, 2);
  });

  it("força propostas antigas a também respeitarem até 6x sem juros", () => {
    const old = structuredClone(DEFAULT_PAYMENT_RULES);
    old.card.visaMaster = [3.89,5.67,6.51,7.02,7.90,8.69,9.48,9.97,11.02,11.98,12.90,13.44];
    old.card.otherBrands = [4.50,5.87,6.57,7.28,7.98,8.68,9.58,10.28,11.02,11.98,12.90,13.50];
    const normalized = normalizePaymentRules(old);
    expect(normalized.card.visaMaster.slice(0, 6)).toEqual([0,0,0,0,0,0]);
    expect(normalized.card.otherBrands.slice(0, 6)).toEqual([0,0,0,0,0,0]);
  });

  it("aplica 8,90% de desconto no Pix", () => {
    expect(DEFAULT_PAYMENT_RULES.pix.discountPercent).toBe(8.9);
    expect(pixTotal(6000, 8.9)).toBe(5466);
    expect(pixTotal(541.63, 8.9)).toBe(493.42);
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
