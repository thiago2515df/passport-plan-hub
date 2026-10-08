import { describe, expect, it } from "vitest";
import { proposalShareMessage } from "@/lib/proposal-message";

const search = { cliente: "LUCAS", destino: "Caldas Novas, Goiás, Brasil", checkin: "2026-10-23", checkout: "2026-10-25", hospedes: "1 quarto · 2 hóspedes", adults: 2, childAges: [], rav: 0 };
describe("standard proposal message", () => {
  it("matches the requested wording and uses a working short public link", () => {
    expect(proposalShareMessage(search, "hdjf65")).toBe("Oi, LUCAS! 😊\n\nPreparei sua proposta para Caldas Novas - GO 🏖️\n\n📅 23 a 25 Outubro 2026\n\n👥 2 pessoas\n\nConfira os detalhes 👇\n\nhttps://propostabsb.excursaobrasilia.com.br/p/hdjf65\n\nQualquer dúvida, estou à disposição! 💬✈️");
  });
  it("omits missing names and counts children", () => {
    const message = proposalShareMessage({ ...search, cliente: "  ", childAges: [5] }, "abcdef");
    expect(message).toContain("Oi! 😊");
    expect(message).toContain("👥 3 pessoas");
  });
  it("supports old guest labels and month/year boundaries", () => {
    const message = proposalShareMessage({ ...search, adults: undefined, checkin: "2026-12-30", checkout: "2027-01-02" }, "abcdef");
    expect(message).toContain("30 Dezembro 2026 a 2 Janeiro 2027");
    expect(message).toContain("👥 2 pessoas");
  });
});