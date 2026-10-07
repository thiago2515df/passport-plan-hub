import { describe, expect, it } from "vitest";
import { makeTransport, encodeProposal, decodeProposal } from "@/lib/hotels";

describe("proposal transport", () => {
  it("applies the Caldas Novas bus schedule", () => {
    const t = makeTransport("bus", "Caldas Novas, Goiás, Brasil");
    expect(t.outbound.departure).toBe("05:00");
    expect(t.outbound.arrival).toBe("12:00");
    expect(t.inbound.departure).toBe("12:00");
    expect(t.inbound.arrival).toBe("20:00");
  });
  it("leaves other destinations and flights manual", () => {
    expect(makeTransport("bus", "Maceió").outbound.departure).toBe("");
    expect(makeTransport("air", "Caldas Novas").outbound.departure).toBe("");
  });
  it("preserves transport and both attachments through shared links", () => {
    const t = makeTransport("air", "Maceió");
    t.outbound.ticket = { path: "ida", name: "ida.pdf", type: "application/pdf" };
    t.inbound.ticket = { path: "volta", name: "volta.png", type: "image/png" };
    const s = { destino: "Maceió", checkin: "2026-11-16", checkout: "2026-11-18", hospedes: "2", rav: 0, transport: t };
    expect(decodeProposal(encodeProposal({ s, hotels: [] }))?.s.transport).toEqual(t);
  });
  it("supports old hotel-only links", () => {
    const s = { destino: "Caldas Novas", checkin: "2026-11-16", checkout: "2026-11-18", hospedes: "2", rav: 0 };
    expect(decodeProposal(encodeProposal({ s, hotels: [] }))?.s.transport).toBeUndefined();
  });
});