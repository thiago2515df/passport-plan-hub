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
export type Flight = { id: string; airline: string; flightNumber: string; from: string; to: string; departure: string; arrival: string; duration: string; stops: string; price: number; travelClass: string; bags: string };
/** Extrai código IATA ("Brasília (BSB)" → "BSB"). */
export const iataOf = (v?: string) => { const m = (v ?? "").toUpperCase().match(/\(([A-Z]{3})\)|^\s*([A-Z]{3})\s*$/); return m ? (m[1] ?? m[2])! : ""; };
export type Ticket = { path: string; name: string; type: string };
export type TransportLeg = { company: string; departure: string; arrival: string; ticket?: Ticket | undefined; from?: string; to?: string; duration?: string; stops?: string };
export type Transport = { mode: TransportMode; outbound: TransportLeg; inbound: TransportLeg; standard?: boolean; price?: number | undefined; travelClass?: string; bags?: string };
/** Valor do pacote para o cliente: hotel + transporte. */
export const packageTotal = (hotelTotal: number, t?: Transport) => hotelTotal + (t && t.mode !== "none" ? t.price ?? 0 : 0);
export const hasBreakfast = (meal?: string) => !!meal && /caf[eé]|breakfast|meia|completa|all/i.test(meal) && !/sem|room only|no meal/i.test(meal);
export type Search = { destino: string; checkin: string; checkout: string; hospedes: string; rav: number; cliente?: string; origem?: string; transport?: Transport };

export const isCaldasNovas = (destination: string) => /\bcaldas\s+novas?\b/i.test(destination);

// Aeroporto mais próximo de destinos comuns (usado para buscar voos sem digitar o código).
const CITY_IATA: [RegExp, string][] = [
  [/caldas\s+novas?/i, "CLV"], [/rio\s+de\s+janeiro/i, "GIG"], [/macei/i, "MCZ"], [/s[aã]o\s+paulo/i, "GRU"],
  [/bras[ií]lia/i, "BSB"], [/salvador/i, "SSA"], [/fortaleza/i, "FOR"], [/recife/i, "REC"], [/natal/i, "NAT"],
  [/porto\s+seguro/i, "BPS"], [/florian/i, "FLN"], [/curitiba/i, "CWB"], [/belo\s+horizonte/i, "CNF"],
  [/goi[aâ]nia/i, "GYN"], [/foz\s+do\s+igua/i, "IGU"], [/manaus/i, "MAO"], [/bel[eé]m/i, "BEL"],
  [/jo[aã]o\s+pessoa/i, "JPA"], [/aracaju/i, "AJU"], [/gramado|canela|porto\s+alegre/i, "POA"],
  [/balne[aá]rio\s+cambori/i, "NVT"], [/canc[uú]n/i, "CUN"], [/orlando|miami/i, "MCO"], [/buenos\s+aires/i, "EZE"],
  [/santiago/i, "SCL"], [/lisboa/i, "LIS"], [/paris/i, "CDG"], [/nova\s+york|new\s+york/i, "JFK"],
];
export const cityIata = (destination: string) => CITY_IATA.find(([re]) => re.test(destination))?.[1] ?? "";
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
