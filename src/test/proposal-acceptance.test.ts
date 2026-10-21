import { describe, expect, it } from "vitest";
import { acceptanceSchema } from "@/lib/proposal-acceptance";
import { decodeProposal, encodeProposal } from "@/lib/hotels";
import { packagePricing } from "@/lib/package-pricing";

describe("accepted package details", () => {
  it("retains the chosen alternative and its seller commission independently of later costs", () => {
    const proposal = { s: { destino: "Maceió", checkin: "2027-02-18", checkout: "2027-02-21", hospedes: "2", rav: 0, transport: { mode: "air" as const, price: 220, outbound: { company: "", departure: "", arrival: "" }, inbound: { company: "", departure: "", arrival: "" } } }, hotels: [{ name: "Hotel A", address: "", stars: 3, image: "", nightly: 100, total: 300 }, { name: "Hotel B", address: "", stars: 4, image: "", nightly: 200, total: 600 }] };
    const pricing = packagePricing(600, proposal.s, { hotel: { kind: "fixed", value: 0 }, air: { kind: "percent", value: 10 }, bus: { kind: "fixed", value: 0 } });
    const record = acceptanceSchema.parse({ code: "accept26", hotel_index: 1, accepted_at: "2026-10-12T17:10:00Z", payload: encodeProposal(proposal), hotel_cost: 600, transport_cost: 220, extras_cost: 0, commission: pricing.commission, total: pricing.total, commission_kind: "percent", commission_value: 10 });
    const changedHotel = proposal.hotels[1];
    if (!changedHotel) throw new Error("Missing hotel fixture");
    changedHotel.total = 900;
    expect(decodeProposal(record.payload)?.hotels[record.hotel_index]?.name).toBe("Hotel B");
    expect(decodeProposal(record.payload)?.hotels[record.hotel_index]?.total).toBe(600);
    expect(record.commission).toBe(82);
    expect(record.total).toBe(902);
  });
});