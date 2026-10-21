import { describe, expect, it } from "vitest";
import {
  availablePackageStep,
  packageFlowSteps,
  packageSearchKey,
  parsePackageStep,
} from "@/lib/package-flow";
import { makeTransport, type Search } from "@/lib/hotels";

const air = { hasSearch: true, hotelCount: 2, mode: "air" as const, flightsReady: true };

describe("mobile package workflow", () => {
  it("requires a search and a hotel before flight selection and both legs before the summary", () => {
    expect(availablePackageStep("resumo", { ...air, hasSearch: false })).toBe("pesquisa");
    expect(availablePackageStep("voos", { ...air, hotelCount: 0 })).toBe("hoteis");
    expect(availablePackageStep("resumo", { ...air, flightsReady: false })).toBe("voos");
    expect(availablePackageStep("resumo", air)).toBe("resumo");
  });
  it("lets the seller go back through every completed stage without removing selections", () => {
    for (const step of ["pesquisa", "hoteis", "voos", "resumo"] as const) {
      expect(availablePackageStep(step, air)).toBe(step);
    }
    expect(air.hotelCount).toBe(2);
  });
  it("skips flights for hotel-only proposals and keeps a transport stage for bus packages", () => {
    expect(packageFlowSteps("none").map((s) => s.id)).toEqual(["pesquisa", "hoteis", "resumo"]);
    expect(availablePackageStep("voos", { ...air, mode: "none", flightsReady: false })).toBe(
      "resumo",
    );
    expect(packageFlowSteps("bus").find((s) => s.id === "voos")?.label).toBe("Transporte");
    expect(availablePackageStep("resumo", { ...air, mode: "bus", flightsReady: false })).toBe(
      "resumo",
    );
    expect(parsePackageStep("unknown")).toBeUndefined();
  });
  it("invalidates dated supplier offers when dates, rooms or transport change, while preserving edits to client and costs", () => {
    const search: Search = {
      destino: "Rio de Janeiro",
      origem: "Brasília (BSB)",
      checkin: "2027-01-10",
      checkout: "2027-01-13",
      hospedes: "2",
      rav: 0,
      transport: makeTransport("air", "Rio de Janeiro"),
    };
    const rooms = [{ adults: 2, childAges: [] }];
    const original = packageSearchKey(search, "rio", rooms);
    expect(packageSearchKey({ ...search, checkout: "2027-01-14" }, "rio", rooms)).not.toBe(
      original,
    );
    expect(packageSearchKey(search, "rio", [{ adults: 2, childAges: [7] }])).not.toBe(original);
    expect(
      packageSearchKey(
        { ...search, transport: makeTransport("none", search.destino) },
        "rio",
        rooms,
      ),
    ).not.toBe(original);
    expect(
      packageSearchKey(
        { ...search, cliente: "Cliente", transport: { ...search.transport!, price: 500 } },
        "rio",
        rooms,
      ),
    ).toBe(original);
  });
});
