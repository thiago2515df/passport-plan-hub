import { describe, expect, it } from "vitest";
import type { Hotel, Search } from "./hotels";
import { customerProposal } from "./customer-proposal";
import {
  appendMultiHotelStay, initialMultiHotelStays, moveMultiHotelBoundary,
  multiHotelBundle, multiHotelStayCost, validateMultiHotelStays,
} from "./multi-hotel";

const hotel = (id: string, total: number): Hotel => ({
  id, name: `Hotel ${id}`, address: "Porto Seguro", stars: 3,
  nightly: total / 3, total, room: "Suíte", image: "https://example.com/img.jpg", x: 50, y: 50,
});

const trip: Search = {
  destino: "Porto Seguro, Bahia, Brasil",
  checkin: "2027-03-10",
  checkout: "2027-03-17",
  rav: 0,
  hospedes: "1 quarto · 2 hóspedes",
  adults: 2,
  rooms: 1,
  transport: {
    mode: "air", price: 500,
    outbound: { company: "GOL", departure: "08:00", arrival: "10:00" },
    inbound: { company: "GOL", departure: "18:00", arrival: "20:00" },
  },
};

describe("Multi-hotel itinerary", () => {
  it("divides seven nights into three plus four without gaps", () => {
    expect(initialMultiHotelStays(trip.checkin, trip.checkout)).toEqual([
      { checkin: "2027-03-10", checkout: "2027-03-13" },
      { checkin: "2027-03-13", checkout: "2027-03-17" },
    ]);
  });

  it("invalidates adjacent dated quotes when a stay boundary changes", () => {
    const stays = initialMultiHotelStays(trip.checkin, trip.checkout).map((stay, i) => ({ ...stay, hotel: hotel(String(i), 500) }));
    const updated = moveMultiHotelBoundary(stays, 0, "2027-03-14");
    expect(updated.map(s => [s.checkin, s.checkout])).toEqual([
      ["2027-03-10", "2027-03-14"], ["2027-03-14", "2027-03-17"],
    ]);
    expect(updated.every(s => !s.hotel)).toBe(true);
  });

  it("supports three sequential hotels and sums only booked nights", () => {
    const stays = appendMultiHotelStay(initialMultiHotelStays(trip.checkin, trip.checkout));
    expect(stays.map(s => s.checkout)).toEqual(["2027-03-13", "2027-03-15", "2027-03-17"]);
    const selected = stays.map((stay, i) => ({ ...stay, hotel: hotel(String(i), 200 * (i + 1)) }));
    expect(validateMultiHotelStays(selected, trip)).toBeNull();
    expect(multiHotelStayCost(selected)).toBe(1200);
    expect(multiHotelBundle(selected).total).toBe(1200);
  });

  it("rejects incomplete or nonconsecutive hotel coverage", () => {
    const stays = initialMultiHotelStays(trip.checkin, trip.checkout);
    expect(validateMultiHotelStays(stays, trip)).toMatch(/Selecione/);
    const broken = [{ ...stays[0]!, hotel: hotel("a", 500) }, { ...stays[1]!, checkin: "2027-03-14", hotel: hotel("b", 600) }];
    expect(validateMultiHotelStays(broken, trip)).toMatch(/consecutivas/);
  });

  it("charges each hotel once, the flight once, and hides per-hotel supplier costs publicly", () => {
    const stays = [
      { checkin: "2027-03-10", checkout: "2027-03-13", hotel: { ...hotel("a", 600), provider: "airbnb" as const, sourceUrl: "https://www.airbnb.com.br/rooms/123" } },
      { checkin: "2027-03-13", checkout: "2027-03-17", hotel: hotel("b", 800) },
    ];
    const bundle = multiHotelBundle(stays);
    const { id: _id, x: _x, y: _y, ...stored } = bundle;
    const projection = customerProposal({ s: { ...trip, multiHotelStays: stays }, hotels: [stored] });
    expect(projection.hotels).toHaveLength(1);
    expect(projection.hotels[0]?.total).toBe(1900); // 600 + 800 + 500 flight
    expect(projection.s.multiHotelStays?.map(stay => stay.hotel?.total)).toEqual([0, 0]);
    expect(projection.s.multiHotelStays?.[0]?.hotel).not.toHaveProperty("sourceUrl");
  });
});
