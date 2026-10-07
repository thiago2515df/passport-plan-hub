export type Hotel = {
  id: string; // offerId da PassHub
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

export type Search = { destino: string; checkin: string; checkout: string; hospedes: string; rav: number };

export const nightsBetween = (a: string, b: string) =>
  Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

type Proposal = { s: Search; hotels: Omit<Hotel, "x" | "y" | "id">[] };
export const encodeProposal = (p: Proposal) => btoa(unescape(encodeURIComponent(JSON.stringify(p))));
export const decodeProposal = (t: string): Proposal | null => {
  try { const p = JSON.parse(decodeURIComponent(escape(atob(t)))); return Array.isArray(p?.hotels) ? p : null; } catch { return null; }
};
