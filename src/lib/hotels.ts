export type Hotel = {
  id: string; // offerId da PassHub
  hotelId?: number;
  name: string;
  address: string;
  stars: number;
  nightly: number; // já com RAV
  total: number; // total da estadia, já com RAV e impostos
  room?: string;
  image: string;
  x: number; // posição no mapa (%)
  y: number;
};

export const COMMISSION = 0.0536;
export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type TransportMode = "none" | "air" | "bus";
export type Ticket = { path: string; name: string; type: string };
export type TransportLeg = { company: string; departure: string; arrival: string; ticket?: Ticket };
export type Transport = { mode: TransportMode; outbound: TransportLeg; inbound: TransportLeg; standard?: boolean };
export type Search = { destino: string; checkin: string; checkout: string; hospedes: string; rav: number; cliente?: string; origem?: string; transport?: Transport };

export const isCaldasNovas = (destination: string) => /\bcaldas\s+novas?\b/i.test(destination);
export const makeTransport = (mode: TransportMode, destination: string): Transport => {
  const standard = mode === "bus" && isCaldasNovas(destination);
  return { mode, standard,
    outbound: { company: standard ? "Viação Águas do Cerrado (ilustrativa)" : "", departure: standard ? "05:00" : "", arrival: standard ? "12:00" : "" },
    inbound: { company: standard ? "Viação Águas do Cerrado (ilustrativa)" : "", departure: standard ? "12:00" : "", arrival: standard ? "20:00" : "" },
  };
};

/** WhatsApp da agência (só dígitos, com DDI 55). Troque pelo número real. */
export const AGENCY_WHATSAPP = "5561999999999";

export const nightsBetween = (a: string, b: string) =>
  Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

type Proposal = { s: Search; hotels: Omit<Hotel, "x" | "y" | "id">[] };
export const encodeProposal = (p: Proposal) => btoa(unescape(encodeURIComponent(JSON.stringify(p))));
export const decodeProposal = (t: string): Proposal | null => {
  try { const p = JSON.parse(decodeURIComponent(escape(atob(t)))); return Array.isArray(p?.hotels) ? p : null; } catch { return null; }
};
