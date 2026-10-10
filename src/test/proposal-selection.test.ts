import { describe, expect, it } from "vitest";
import { toggleHotelSelection, nextFlightSelectionStep } from "@/lib/proposal-selection";
import { encodeProposal, decodeProposal } from "@/lib/hotels";

describe("proposal selection", () => {
  it("allows more than three hotels without imposing a selection limit and preserves them in the proposal", () => {
    let selected: string[] = [];
    for (let i = 0; i < 125; i++) selected = toggleHotelSelection(selected, `hotel-${i}`);
    expect(selected).toHaveLength(125);
    expect(selected[3]).toBe("hotel-3");
    expect(selected[124]).toBe("hotel-124");
    const hotels = selected.map(name => ({ name, address: "", stars: 0, nightly: 100, total: 200, image: "" }));
    const s = { destino: "Rio de Janeiro", checkin: "2027-05-10", checkout: "2027-05-14", hospedes: "2", rav: 0 };
    expect(decodeProposal(encodeProposal({ s, hotels }))?.hotels).toEqual(hotels);
    expect(toggleHotelSelection(selected, "hotel-3")).toEqual(selected.filter(id => id !== "hotel-3"));
  });
  it("advances from outbound selection to return selection", () => {
    expect(nextFlightSelectionStep("out")).toBe("back");
  });
  it("advances from return selection to proposal generation", () => {
    expect(nextFlightSelectionStep("back")).toBe("summary");
  });
});