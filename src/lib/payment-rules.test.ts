import { describe, expect, it } from "vitest";
import { DEFAULT_PAYMENT_RULES, installmentQuote, normalizePaymentRules, pixTotal } from "./payment-rules";

describe("parcelamento mostrado ao cliente", () => {
  it("reproduz a tabela Visa/Master enviada usando gross-up", () => {
    const expected = [1040.47, 530.05, 356.54, 268.88, 217.16, 182.53, 157.82, 138.84, 124.87, 113.61, 104.37, 96.27];
    DEFAULT_PAYMENT_RULES.card.visaMaster.forEach((rate, index) => {
      const q = installmentQuote(1000, index + 1, rate)!;
      expect(q.installment).toBeCloseTo(expected[index]!, 2);
    });
  });

  it("usa as taxas específicas das demais bandeiras", () => {
    expect(installmentQuote(1000, 1, DEFAULT_PAYMENT_RULES.card.otherBrands[0]!)?.total).toBeCloseTo(1047.12, 2);
    expect(installmentQuote(1000, 12, DEFAULT_PAYMENT_RULES.card.otherBrands[11]!)?.installment).toBeCloseTo(96.34, 2);
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
    invalid.card.visaMaster[0] = 99;
    expect(normalizePaymentRules(invalid)).toEqual(DEFAULT_PAYMENT_RULES);
  });
});
