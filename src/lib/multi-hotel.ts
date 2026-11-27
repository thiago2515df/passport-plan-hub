import type { Hotel, Search } from "./hotels";
import { nightsBetween } from "./hotels";

export type MultiHotelStay = {
  checkin: string;
  checkout: string;
  hotel?: Hotel;
};

const dateIso = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T12:00:00"));

export const addDays = (value: string, days: number) => {
  const date = new Date(value + "T12:00:00");
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  return `${yyyy}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function initialMultiHotelStays(checkin: string, checkout: string): MultiHotelStay[] {
  const nights = nightsBetween(checkin, checkout);
  if (!dateIso(checkin) || !dateIso(checkout) || checkout <= checkin || nights < 2) return [];
  const split = addDays(checkin, Math.floor(nights / 2));
  return [{ checkin, checkout: split }, { checkin: split, checkout }];
}

/** Divide o último período em dois, mantendo os demais hotéis já escolhidos. */
export function appendMultiHotelStay(stays: MultiHotelStay[]): MultiHotelStay[] {
  const last = stays[stays.length - 1];
  if (!last || nightsBetween(last.checkin, last.checkout) < 2) return stays;
  const split = addDays(last.checkin, Math.floor(nightsBetween(last.checkin, last.checkout) / 2));
  return [
    ...stays.slice(0, -1),
    { checkin: last.checkin, checkout: split },
    { checkin: split, checkout: last.checkout },
  ];
}

/** Ajustar uma divisa altera as duas estadias e invalida suas tarifas antigas. */
export function moveMultiHotelBoundary(stays: MultiHotelStay[], index: number, date: string): MultiHotelStay[] {
  const left = stays[index];
  const right = stays[index + 1];
  if (!left || !right || !dateIso(date) || date <= left.checkin || date >= right.checkout) return stays;
  return stays.map((stay, i) => i === index
    ? { checkin: stay.checkin, checkout: date }
    : i === index + 1 ? { checkin: date, checkout: stay.checkout } : stay);
}

export function removeLastMultiHotelStay(stays: MultiHotelStay[]): MultiHotelStay[] {
  if (stays.length <= 2) return stays;
  const previous = stays[stays.length - 2]!;
  const last = stays[stays.length - 1]!;
  return [...stays.slice(0, -2), { checkin: previous.checkin, checkout: last.checkout }];
}

export const multiHotelStayCost = (stays: MultiHotelStay[]) =>
  Math.round(stays.reduce((total, stay) => total + (stay.hotel?.total ?? 0), 0) * 100) / 100;

export function validateMultiHotelStays(
  stays: MultiHotelStay[],
  trip: Pick<Search, "checkin" | "checkout">,
): string | null {
  if (!Array.isArray(stays) || stays.length < 2) return "Adicione pelo menos dois períodos de hospedagem.";
  if (!dateIso(trip.checkin) || !dateIso(trip.checkout) || stays[0]?.checkin !== trip.checkin ||
      stays[stays.length - 1]?.checkout !== trip.checkout) {
    return "As hospedagens precisam cobrir todo o período da viagem.";
  }
  for (let i = 0; i < stays.length; i++) {
    const stay = stays[i]!;
    if (!dateIso(stay.checkin) || !dateIso(stay.checkout) || stay.checkout <= stay.checkin) {
      return `Confira as datas da hospedagem ${i + 1}.`;
    }
    if (i > 0 && stays[i - 1]!.checkout !== stay.checkin) {
      return "As datas dos hotéis precisam ser consecutivas, sem lacunas ou sobreposição.";
    }
    if (!stay.hotel || !stay.hotel.name?.trim() || !Number.isFinite(stay.hotel.total) || stay.hotel.total <= 0) {
      return `Selecione uma hospedagem com tarifa válida para o período ${i + 1}.`;
    }
    if ((stay.hotel.provider === "trivago" || stay.hotel.provider === "booking") && !stay.hotel.priceConfirmed) {
      return `Confirme a tarifa da hospedagem para o período ${i + 1} antes de gerar a proposta.`;
    }
  }
  return null;
}

/** One bookable package containing multiple consecutive supplier stays. */
export function multiHotelBundle(stays: MultiHotelStay[]): Hotel {
  const first = stays[0]?.hotel;
  const total = multiHotelStayCost(stays);
  const nights = stays.reduce((sum, stay) => sum + nightsBetween(stay.checkin, stay.checkout), 0);
  return {
    id: "multi-hotel-package",
    name: `Roteiro Multi-hotel · ${stays.length} hospedagens`,
    address: stays.map(stay => stay.hotel?.name).filter(Boolean).join(" + "),
    stars: 0,
    nightly: nights ? total / nights : total,
    total,
    room: `${stays.length} hospedagens consecutivas`,
    image: first?.image ?? "",
    x: 50,
    y: 50,
    extras: [],
  };
}
