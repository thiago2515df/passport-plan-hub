import { describe, expect, it } from "vitest";

import { customerNotice, isArchived } from "@/lib/proposal-status";

describe("Arquivar proposta", () => {
  it("tira do quadro uma proposta arquivada ou cancelada, mas mantém as demais", () => {
    expect(isArchived("archived")).toBe(true);
    expect(isArchived("cancelled")).toBe(true);
    expect(isArchived("created")).toBe(false);
    expect(isArchived("awaiting")).toBe(false);
    expect(isArchived("approved")).toBe(false);
  });

  it("mostra 'Proposta arquivada' ao cliente, sem revelar custos", () => {
    expect(customerNotice("archived")).toEqual({
      title: "Proposta arquivada",
      text: "Esta proposta foi arquivada pela nossa equipe. Fale com o seu agente de viagens para receber uma nova cotação.",
    });
    const notice = customerNotice("archived")!;
    expect(notice.title + notice.text).not.toMatch(/R\$|comiss/i);
  });

  it("mantém o aviso de validade para propostas vencidas", () => {
    expect(customerNotice("expired")?.title).toBe("Esta proposta está vencida");
    expect(customerNotice("cancelled")?.title).toBe("Esta proposta está vencida");
    expect(customerNotice("active")).toBeNull();
    expect(customerNotice("approved")).toBeNull();
  });
});
