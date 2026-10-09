export const toggleHotelSelection = (selected: string[], id: string): string[] =>
  selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];

export type ProposalSelectionStep = "out" | "back" | "summary";

export const nextFlightSelectionStep = (leg: "out" | "back"): ProposalSelectionStep =>
  leg === "out" ? "back" : "summary";