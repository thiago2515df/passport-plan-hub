import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Flight } from "./hotels";
import { mapFlightOffer, type FlightOffer } from "./flight-offers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const searchFlights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      from: z.string().regex(/^[A-Z]{3}$/),
      to: z.string().regex(/^[A-Z]{3}$/),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      adults: z.number().int().min(1).max(9),
      children: z.number().int().min(0).max(8),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ flights: Flight[]; error?: string }> => {
    const { assertPermission } = await import("./access.server");
    await assertPermission(context.supabase, "search_flights");
    const { passhub } = await import("./passhub.server");
    try {
      const r = await passhub<{ offers?: FlightOffer[] }>("/searches", {
        method: "POST",
        keyName: "PASSHUB_AIR_API_KEY",
        body: {
          type: "flight", iataFrom: data.from, iataTo: data.to, adults: data.adults,
          ...(data.children ? { children: data.children } : {}),
          dates: [{ departure: data.date }], ravPercentage: 0, initialWaitSeconds: 40,
        },
      });
      const flights = (r.offers ?? []).map((o, i) => mapFlightOffer(o, i, data.from, data.to));
      flights.sort((a, b) => a.price - b.price);
      return { flights };
    } catch (e) {
      return { flights: [], error: (e as Error).message };
    }
  });
