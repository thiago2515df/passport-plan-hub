// Dados de demonstração. Substituir pela API PassHub (via server function) quando as credenciais estiverem disponíveis.
import h1 from "@/assets/h1.jpg";
import h2 from "@/assets/h2.jpg";
import h3 from "@/assets/h3.jpg";

export type Hotel = {
  id: string;
  name: string;
  address: string;
  stars: number;
  nightly: number;
  image: string;
  x: number; // posição no mapa (%)
  y: number;
};

export const HOTELS: Hotel[] = [
  { id: "1", name: "Hotstar Hotel", address: "Rua Francisca Ala Cunha Qd 08 Lt 03 - Privê das Caldas, Caldas Novas - GO, 75690-000, Brazil", stars: 3, nightly: 260.96, image: h1, x: 58, y: 44 },
  { id: "2", name: "Hot Star Plaza Hotel", address: "Rua Francisca Ala Cunha Qd 08 Lt 03 - Privê das Caldas, Caldas Novas - GO, 75690-000, Brazil", stars: 0, nightly: 271.04, image: h1, x: 55, y: 48 },
  { id: "3", name: "Manhattan Hotel", address: "Rua 11 Quadra 06 Lotes 2426, Caldas Novas - GO", stars: 3, nightly: 276.64, image: h2, x: 62, y: 52 },
  { id: "4", name: "Pousada das Águas", address: "Av. Orcalino Santos 120, Centro, Caldas Novas - GO", stars: 2, nightly: 479, image: h2, x: 70, y: 60 },
  { id: "5", name: "Thermas Park Resort", address: "Rod. GO-139 Km 2, Caldas Novas - GO", stars: 4, nightly: 712, image: h3, x: 28, y: 62 },
  { id: "6", name: "Rio Quente Termas", address: "Rua Particular s/n, Rio Quente - GO", stars: 5, nightly: 1557, image: h3, x: 12, y: 75 },
  { id: "7", name: "Lago Azul Resort", address: "Rua do Lago 45, Caldas Novas - GO", stars: 4, nightly: 1161, image: h3, x: 82, y: 66 },
];

export const COMMISSION = 0.0536;
export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type Search = { destino: string; checkin: string; checkout: string; hospedes: string; rav: number };

export const nightsBetween = (a: string, b: string) =>
  Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

export const encodeProposal = (p: { s: Search; ids: string[] }) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(p))));
export const decodeProposal = (t: string): { s: Search; ids: string[] } | null => {
  try { return JSON.parse(decodeURIComponent(escape(atob(t)))); } catch { return null; }
};
