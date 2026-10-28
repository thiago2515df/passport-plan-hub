import { describe, expect, it } from "vitest";
import { DEFAULT_PAYMENT_RULES, installmentQuote, normalizePaymentRules, pixTotal } from "./payment-rules";

describe("parcelamento mostrado ao cliente", () => {
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

  it("não altera o Pix enquanto o desconto estiver em zero", () => {
    expect(pixTotal(541.63, 0)).toBe(541.63);
    expect(pixTotal(1000, 5)).toBe(950);
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
