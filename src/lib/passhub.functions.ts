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
      const label: Record<string, string> = { City: "Cidade", "Multi-City (Vicinity)": "Região", Neighborhood: "Bairro", Airport: "Aeroporto" };
      const seen = new Set<string>();
      const items = (r.destinations ?? [])
        .filter((d) => d.type?.toLowerCase() !== "hotel")
        .filter((d) => (seen.has(d.destinationId + d.name) ? false : (seen.add(d.destinationId + d.name), true)))
        .sort((a, b) => (a.type === "City" ? -1 : 0) - (b.type === "City" ? -1 : 0))
        .map((d) => ({ id: d.destinationId, name: d.name, type: label[d.type] ?? d.type }));
      return { items };
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
          hotelId: o.hotel.hotelId,
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

export const getHotelDetails = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ hotelId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const { passhub } = await import("./passhub.server");
    try {
      const h = await passhub<{ description?: string; photos?: { url: string }[]; amenities?: { name: string }[] }>(`/hotel/hotels/${data.hotelId}`);
      return {
        photos: (h.photos ?? []).map((p) => p.url).filter(Boolean),
        description: h.description ?? "",
        amenities: (h.amenities ?? []).map((a) => a.name).filter(Boolean),
      };
    } catch (e) {
      return { photos: [] as string[], description: "", amenities: [] as string[], error: (e as Error).message };
    }
  });
