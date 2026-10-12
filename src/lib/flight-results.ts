import type { Flight } from "./hotels";
import { connectionAirportLabel } from "./customer-itinerary";

const airportNames: Record<string, string> = {
  BSB: "Juscelino Kubitschek Brasília", GRU: "São Paulo Guarulhos Governador André Franco Montoro Cumbica",
  CGH: "São Paulo Congonhas Deputado Freitas Nobre", VCP: "Campinas Viracopos",
  GIG: "Rio de Janeiro Galeão Tom Jobim", SDU: "Rio de Janeiro Santos Dumont",
  SSA: "Salvador Deputado Luís Eduardo Magalhães", CNF: "Belo Horizonte Confins Tancredo Neves",
  BPS: "Porto Seguro", MCZ: "Maceió Zumbi dos Palmares", CLV: "Caldas Novas Nelson Ribeiro Guimarães",
};
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function filterFlightResults(flights: Flight[], query: string, directOnly: boolean, sort: "asc" | "desc") {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return flights.filter(flight => {
    if (directOnly && flight.stops !== "Direto") return false;
    const airports = [flight.from, flight.to, ...(flight.connections ?? [])];
    const searchable = normalize([flight.airline, flight.flightNumber, ...airports.flatMap(code => [code, connectionAirportLabel(code), airportNames[code] ?? ""])].join(" "));
    return terms.every(term => searchable.includes(term));
  }).sort((a, b) => sort === "asc" ? a.price - b.price : b.price - a.price);
}