export type ExtraService = { name: string; cost: number };

/** Public information about a selected Airbnb, saved with the client proposal. */
export type AirbnbPropertyDetails = {
  photos: string[];
  description: string;
  amenities: string[];
  highlights: string[];
  propertyType: string;
  cancellationPolicy: string;
  hostName: string;
  rating?: number;
  reviewCount?: number;
  personCapacity?: number;
  roomType?: string;
  city?: string;
  badges?: string[];
  isSuperhost?: boolean;
};

export type Hotel = {
  id: string; // offerId da PassHub ou id normalizado do fornecedor
  hotelId?: number;
  /** Origem da hospedagem, preservada ao gerar e reabrir propostas. */
  provider?: "hotel" | "airbnb" | "trivago";
  providerListingId?: string;
  /** Cached PDP details: avoids paid public API calls when clients view a proposal. */
  publicDetails?: AirbnbPropertyDetails;
  /** True when GeckoAPI did not return a stay total including fees. */
  totalEstimated?: boolean;
  /** Trivago advertised stay totals still require supplier tax/availability confirmation. */
  priceConfirmed?: boolean;
  supplierName?: string;
  /** Internal diagnostic when a Trivago listing has no dated supplier quote. */
  quoteError?: string;
  sourceUrl?: string;
  rating?: number;
  reviewCount?: number;
  images?: string[];
  name: string;
  address: string;
  stars: number;
  nightly: number; // valor exibido por noite
  total: number; // total da estadia, incluindo taxas quando a origem informar
  room?: string;
  image: string;
  x: number; // posição no mapa (%)
  y: number;
  extras?: ExtraService[];
};

export const COMMISSION = 0.0536;
export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type TransportMode = "none" | "air" | "bus";
export type FlightConnection = { airport: string; arrivalTime?: string | undefined; departureTime?: string | undefined; duration?: string | undefined; nextDepartureAirport?: string | undefined; isAirportChange?: boolean | undefined };
export type Flight = {
  /** An old stored itinerary has no independent per-leg fare; do not show R$ 0. */
  savedPriceUnavailable?: boolean;
  id: string; airline: string; flightNumber: string; from: string; to: string; departure: string; arrival: string; duration: string; stops: string; price: number; travelClass: string; bags: string;
  departureDate?: string; arrivalDate?: string; fareCategory?: string; connections?: string[]; connectionDetails?: FlightConnection[] | undefined;
  baggage?: { personal?: boolean; carryOn?: boolean; checked?: boolean };
  installments?: { count: number; interestFree?: boolean }; commission?: number; fareRules?: string;
};
/**
 * Extrai o IATA principal de rótulos da PassHub.
 * Exemplos: "Brasília (BSB)" → BSB, "São Paulo (CGH/SBSP)" → CGH.
 */
export const iataOf = (v?: string) => {
  const value = (v ?? "").toUpperCase();
  const paren = value.match(/\(([A-Z]{3})(?:\/[A-Z0-9]{4})?\)/);
  if (paren?.[1]) return paren[1];
  const plain = value.match(/^\s*([A-Z]{3})\s*$/);
  return plain?.[1] ?? "";
};
export type Ticket = { path: string; name: string; type: string };
export type TransportLeg = { company: string; departure: string; arrival: string; ticket?: Ticket | undefined; from?: string; to?: string; duration?: string; stops?: string; airline?: string | undefined; flightNumber?: string | undefined; departureDate?: string | undefined; arrivalDate?: string | undefined; fareCategory?: string | undefined; connections?: string[] | undefined; connectionDetails?: FlightConnection[] | undefined; baggage?: Flight["baggage"] | undefined };
export type Transport = { mode: TransportMode; outbound: TransportLeg; inbound: TransportLeg; standard?: boolean; price?: number | undefined; travelClass?: string; bags?: string };
/** Valor do pacote para o cliente: hotel + transporte. */
export const packageTotal = (hotelTotal: number, t?: Transport) => hotelTotal + (t && t.mode !== "none" ? t.price ?? 0 : 0);
export const hasBreakfast = (meal?: string) => !!meal && /caf[eé]|breakfast|meia|completa|all/i.test(meal) && !/sem|room only|no meal/i.test(meal);
import type { RoomOccupancy } from "./room-occupancy";
import type { PaymentRules } from "./payment-rules";
export type Search = { paymentRules?: PaymentRules; interestFreeInstallments?: number; selectedFlights?: { out?: Flight; back?: Flight }; selectedFlightOptions?: { out: Flight[]; back: Flight[] }; roomOccupancies?: RoomOccupancy[]; destino: string; checkin: string; checkout: string; hospedes: string; rav: number; cliente?: string; telefone?: string; email?: string; origem?: string; transport?: Transport; destinationId?: string; rooms?: number; adults?: number; childAges?: number[]; extras?: ExtraService[] };

export const isCaldasNovas = (destination: string) => /\bcaldas\s+novas?\b/i.test(destination);

// Aeroporto/código metropolitano usado quando o usuário escolhe uma cidade genérica
// ou um destino turístico sem aeroporto comercial relevante.
// SAO e RIO são expandidos no servidor para os aeroportos principais da região.
const CITY_IATA: [RegExp, string][] = [
  // Destinos turísticos sem aeroporto próprio/relevante
  [/arraial\s+do\s+cabo|b[uú]zios|arma[cç][aã]o\s+dos\s+b[uú]zios|cabo\s+frio|angra\s+dos\s+reis|paraty/i, "RIO"],
  [/porto\s+de\s+galinhas|ipojuca|muro\s+alto|maraca[ií]pe|carneiros|tamandar[eé]/i, "REC"],
  [/pipa|tibau\s+do\s+sul|s[aã]o\s+miguel\s+do\s+gostoso/i, "NAT"],
  [/praia\s+do\s+forte|mata\s+de\s+s[aã]o\s+jo[aã]o|morro\s+de\s+s[aã]o\s+paulo|itacar[eé]/i, "SSA"],
  [/gramado|canela|bento\s+gon[cç]alves|nova\s+petr[oó]polis/i, "POA"],
  [/balne[aá]rio\s+cambori[uú]|bombinhas|itapema|penha/i, "NVT"],
  [/campos\s+do\s+jord[aã]o|ilhabela|ubatuba/i, "SAO"],
  [/guarapari|vila\s+velha/i, "VIX"],
  [/porto\s+de\s+pedras|s[aã]o\s+miguel\s+dos\s+milagres|maragogi/i, "MCZ"],
  [/caldas\s+novas?/i, "CLV"],

  // Capitais e cidades com aeroporto comercial
  [/rio\s+de\s+janeiro/i, "RIO"], [/macei/i, "MCZ"], [/s[aã]o\s+paulo/i, "SAO"],
  [/bras[ií]lia/i, "BSB"], [/salvador/i, "SSA"], [/fortaleza/i, "FOR"], [/recife/i, "REC"], [/natal/i, "NAT"],
  [/porto\s+seguro/i, "BPS"], [/florian/i, "FLN"], [/curitiba/i, "CWB"], [/belo\s+horizonte/i, "CNF"],
  [/goi[aâ]nia/i, "GYN"], [/foz\s+do\s+igua/i, "IGU"], [/manaus/i, "MAO"], [/bel[eé]m/i, "BEL"],
  [/jo[aã]o\s+pessoa/i, "JPA"], [/aracaju/i, "AJU"], [/porto\s+alegre/i, "POA"],
  [/vit[oó]ria/i, "VIX"], [/teresina/i, "THE"], [/s[aã]o\s+lu[ií]s/i, "SLZ"], [/palmas/i, "PMW"],
  [/campo\s+grande/i, "CGR"], [/cuiab[aá]/i, "CGB"], [/porto\s+velho/i, "PVH"], [/rio\s+branco/i, "RBR"],
  [/boa\s+vista/i, "BVB"], [/macap[aá]/i, "MCP"],

  // Fallback por estado/UF quando a cidade escolhida não tiver aeroporto mapeado.
  [/\b(?:rio\s+de\s+janeiro|rj)\b/i, "RIO"],
  [/\b(?:pernambuco|pe)\b/i, "REC"],
  [/\b(?:rio\s+grande\s+do\s+norte|rn)\b/i, "NAT"],
  [/\b(?:bahia|ba)\b/i, "SSA"],
  [/\b(?:rio\s+grande\s+do\s+sul|rs)\b/i, "POA"],
  [/\b(?:santa\s+catarina|sc)\b/i, "FLN"],
  [/\b(?:s[aã]o\s+paulo|sp)\b/i, "SAO"],
  [/\b(?:esp[ií]rito\s+santo|es)\b/i, "VIX"],
  [/\b(?:alagoas|al)\b/i, "MCZ"],
  [/\b(?:para[ií]ba|pb)\b/i, "JPA"],
  [/\b(?:sergipe|se)\b/i, "AJU"],
  [/\b(?:cear[aá]|ce)\b/i, "FOR"],
  [/\b(?:goi[aá]s|go)\b/i, "GYN"],
  [/\b(?:minas\s+gerais|mg)\b/i, "CNF"],
  [/\b(?:paran[aá]|pr)\b/i, "CWB"],
  [/\b(?:par[aá]|pa)\b/i, "BEL"],
  [/\b(?:amazonas|am)\b/i, "MAO"],
  [/\b(?:maranh[aã]o|ma)\b/i, "SLZ"],
  [/\b(?:piau[ií]|pi)\b/i, "THE"],
  [/\b(?:tocantins|to)\b/i, "PMW"],
  [/\b(?:mato\s+grosso\s+do\s+sul|ms)\b/i, "CGR"],
  [/\b(?:mato\s+grosso|mt)\b/i, "CGB"],
  [/\b(?:rond[oô]nia|ro)\b/i, "PVH"],
  [/\b(?:acre|ac)\b/i, "RBR"],
  [/\b(?:roraima|rr)\b/i, "BVB"],
  [/\b(?:amap[aá]|ap)\b/i, "MCP"],

  // Internacionais
  [/canc[uú]n/i, "CUN"], [/orlando/i, "MCO"], [/miami/i, "MIA"], [/buenos\s+aires/i, "EZE"],
  [/santiago/i, "SCL"], [/lisboa/i, "LIS"], [/paris/i, "CDG"], [/nova\s+york|new\s+york/i, "JFK"],
];

export const cityIata = (destination: string) => {
  const value = destination.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return CITY_IATA.find(([re]) => re.test(value))?.[1] ?? "";
};
export const makeTransport = (mode: TransportMode, destination: string): Transport => {
  const standard = mode === "bus" && isCaldasNovas(destination);
  return { mode, standard,
    outbound: { company: standard ? "Viação Águas do Cerrado (ilustrativa)" : "", departure: standard ? "05:00" : "", arrival: standard ? "12:00" : "" },
    inbound: { company: standard ? "Viação Águas do Cerrado (ilustrativa)" : "", departure: standard ? "12:00" : "", arrival: standard ? "20:00" : "" },
  };
};

/** WhatsApp da agência (só dígitos, com DDI 55). Troque pelo número real. */
export const AGENCY_WHATSAPP = "5561992267062";

export const nightsBetween = (a: string, b: string) =>
  Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

type Proposal = { s: Search; hotels: Omit<Hotel, "x" | "y" | "id">[] };
export const encodeProposal = (p: Proposal) => btoa(unescape(encodeURIComponent(JSON.stringify(p))));
export const decodeProposal = (t: string): Proposal | null => {
  try { const p = JSON.parse(decodeURIComponent(escape(atob(t)))); return Array.isArray(p?.hotels) ? p : null; } catch { return null; }
};
