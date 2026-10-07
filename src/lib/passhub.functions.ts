import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Hotel } from "./hotels";

type Fail = { error: string };

export const searchDestinations = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().min(3).max(80) }).parse(d))
  .handler(async ({ data }): Promise<{ items: { id: string; name: string; type: string }[] } & Partial<Fail>> => {
    const { passhub } = await import("./passhub.server");
    try {
      const r = await passhub<{ destinations: { destinationId: string; name: string; type: string }[] }>(
        `/hotel/destinations?q=${encodeURIComponent(data.q)}`,
      );
      return { items: (r.destinations ?? []).map((d) => ({ id: d.destinationId, name: d.name, type: d.type })) };
    } catch (e) {
      return { items: [], error: (e as Error).message };
    }
  });

export const searchHotels = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        destinationId: z.string().min(1),
        checkinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        nights: z.number().int().min(1).max(30),
        adults: z.number().int().min(1).max(9),
        childAges: z.array(z.number().int().min(0).max(17)).max(4),
        rooms: z.number().int().min(1).max(9),
        rav: z.number().int().min(0).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ hotels: Hotel[] } & Partial<Fail>> => {
    const { passhub } = await import("./passhub.server");
    try {
      type Offer = {
        offerId: string; totalPrice: number; dailyPrice?: number; roomName?: string; mealPlan?: string;
        hotel: { hotelId: number; hotelName: string; hotelAddress?: string; starRating?: number; latitude?: number; longitude?: number; thumbUrl?: string };
      };
      const r = await passhub<{ offers: Offer[] }>("/searches", {
        method: "POST",
        body: {
          type: "hotel",
          destinationId: data.destinationId,
          checkinDate: data.checkinDate,
          nights: data.nights,
          rooms: [{ adults: data.adults, childAges: data.childAges, quantity: data.rooms }],
          ravPercentage: data.rav,
        },
      });
      const offers = r.offers ?? [];
      const lats = offers.map((o) => o.hotel.latitude).filter((v): v is number => typeof v === "number");
      const lngs = offers.map((o) => o.hotel.longitude).filter((v): v is number => typeof v === "number");
      const [minLa, maxLa, minLo, maxLo] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
      const pos = (v: number | undefined, a: number, b: number, inv = false) => {
        if (typeof v !== "number" || !isFinite(a) || b === a) return 50;
        const t = (v - a) / (b - a);
        return 8 + (inv ? 1 - t : t) * 84;
      };
      return {
        hotels: offers.map((o) => ({
          id: o.offerId,
          name: o.hotel?.hotelName ?? "Hotel",
          address: o.hotel?.hotelAddress ?? "",
          stars: Math.round(o.hotel.starRating ?? 0),
          nightly: o.totalPrice / data.nights,
          total: o.totalPrice,
          room: [o.roomName, o.mealPlan].filter(Boolean).join(" · "),
          image: o.hotel.thumbUrl ?? "",
          x: pos(o.hotel.longitude, minLo, maxLo),
          y: pos(o.hotel.latitude, minLa, maxLa, true),
        })),
      };
    } catch (e) {
      return { hotels: [], error: (e as Error).message };
    }
  });
