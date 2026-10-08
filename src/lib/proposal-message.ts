import type { Search } from "./hotels";

const states: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE",
  "distrito federal": "DF", "espirito santo": "ES", goias: "GO", maranhao: "MA",
  "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", para: "PA",
  paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR",
  "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const longDate = (value: Date) => {
  const month = value.toLocaleDateString("pt-BR", { month: "long" });
  return `${value.getDate()} ${month.charAt(0).toUpperCase()}${month.slice(1)} ${value.getFullYear()}`;
};

export const proposalShareMessage = (s: Search, code: string) => {
  const name = s.cliente?.trim();
  const parts = s.destino.split(",").map(part => part.trim());
  const city = (parts[0] ?? "").replace(/\s*\([A-Z]{3}\)\s*/gi, "").trim();
  const region = parts[1] ?? "";
  const state = states[normalize(region)] ?? (Object.values(states).includes(region.toUpperCase()) ? region.toUpperCase() : "");
  const destination = `${city}${state ? ` - ${state}` : /^caldas novas?$/i.test(city) ? " - GO" : ""}`;
  const start = new Date(`${s.checkin}T12:00:00`);
  const end = new Date(`${s.checkout}T12:00:00`);
  const dates = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()
    ? `${start.getDate()} a ${longDate(end)}` : `${longDate(start)} a ${longDate(end)}`;
  const legacyCount = s.hospedes.match(/(\d+)\s*(?:h[oó]spedes?|pessoas?)/i)?.[1] ?? s.hospedes.match(/^\s*(\d+)\s*$/)?.[1];
  const people = typeof s.adults === "number" ? s.adults + (s.childAges?.length ?? 0) : legacyCount ? Number(legacyCount) : null;
  const guests = people !== null ? `${people} ${people === 1 ? "pessoa" : "pessoas"}` : s.hospedes;
  return `Oi${name ? `, ${name}` : ""}! 😊\n\nPreparei sua proposta para ${destination} 🏖️\n\n📅 ${dates}\n\n👥 ${guests}\n\nConfira os detalhes 👇\n\nhttps://propostabsb.excursaobrasilia.com.br/p/${code}\n\nQualquer dúvida, estou à disposição! 💬✈️`;
};