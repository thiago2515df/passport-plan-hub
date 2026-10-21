import type { Search, TransportMode } from "./hotels";
import type { RoomOccupancy } from "./room-occupancy";

export const packageSteps = ["pesquisa", "hoteis", "voos", "resumo"] as const;
export type PackageStep = (typeof packageSteps)[number];
export const parsePackageStep = (value: unknown): PackageStep | undefined =>
  packageSteps.includes(value as PackageStep) ? (value as PackageStep) : undefined;

export function packageFlowSteps(mode: TransportMode): { id: PackageStep; label: string }[] {
  return [
    { id: "pesquisa", label: "Pesquisa" },
    { id: "hoteis", label: "Hotéis" },
    ...(mode === "none"
      ? []
      : [{ id: "voos" as const, label: mode === "air" ? "Voos" : "Transporte" }]),
    { id: "resumo", label: "Resumo" },
  ];
}

/** Returning to an earlier screen never requires discarding the current choices. */
export function availablePackageStep(
  requested: PackageStep,
  state: { hasSearch: boolean; hotelCount: number; mode: TransportMode; flightsReady: boolean },
): PackageStep {
  if (requested === "pesquisa" || !state.hasSearch) return "pesquisa";
  if (requested === "hoteis" || !state.hotelCount) return "hoteis";
  if (state.mode === "none") return "resumo";
  if (requested === "resumo" && state.mode === "air" && !state.flightsReady) return "voos";
  return requested;
}

/** Names, edited costs and flight selections do not change the supplier search. */
export const packageSearchKey = (search: Search, destinationId: string, rooms: RoomOccupancy[]) =>
  JSON.stringify([
    search.destino,
    destinationId,
    search.origem ?? "",
    search.checkin,
    search.checkout,
    rooms,
    search.transport?.mode ?? "none",
    search.rav,
  ]);
