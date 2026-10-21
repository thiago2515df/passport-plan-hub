import { describe, expect, it } from "vitest";
import { normalizeExtraServices } from "./extra-services";

describe("serviços opcionais na geração de propostas", () => {
  it("ignora linha vazia criada por Adicionar serviço", () => {
    expect(normalizeExtraServices([{ name: "", cost: 0 }], "Hotel Caldas")).toEqual([]);
    expect(normalizeExtraServices([{ name: "  ", cost: 0 }], "Hotel Caldas")).toEqual([]);
  });

  it("preserva serviços válidos e respectivos valores", () => {
    expect(normalizeExtraServices([
      { name: "  Almoço  ", cost: 200 },
      { name: "", cost: 0 },
      { name: "Passeio", cost: 0 },
    ], "Hotel Caldas")).toEqual([
      { name: "Almoço", cost: 200 },
      { name: "Passeio", cost: 0 },
    ]);
  });

  it("não esconde custo de serviço sem nome", () => {
    expect(() => normalizeExtraServices([{ name: "  ", cost: 120 }], "Hotel Caldas"))
      .toThrow(/Preencha o nome.*Hotel Caldas/);
  });

  it("rejeita custo inválido e nome excessivo", () => {
    expect(() => normalizeExtraServices([{ name: "Passeio", cost: -1 }])).toThrow(/valor válido/);
    expect(() => normalizeExtraServices([{ name: "Passeio", cost: Number.NaN }])).toThrow(/valor válido/);
    expect(() => normalizeExtraServices([{ name: "x".repeat(121), cost: 0 }])).toThrow(/120 caracteres/);
  });

  it("funciona mesmo sem nenhum serviço adicional", () => {
    expect(normalizeExtraServices(undefined)).toEqual([]);
  });
});
