import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Flight } from "./hotels";
import { mapFlightOffer, type FlightOffer } from "./flight-offers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const METRO_AIRPORTS: Record<string, string[]> = {
  SAO: ["CGH", "GRU", "VCP"],
  RIO: ["SDU", "GIG"],
};

const expandAirport = (code: string) => METRO_AIRPORTS[code] ?? [code];

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
    const { assertSearchPermission } = await import("./access.server");
    await assertSearchPermission(context.supabase, context.userId, "search_flights");
    const { passhub } = await import("./passhub.server");

    const origins = expandAirport(data.from);
    const destinations = expandAirport(data.to);
    const routes = origins.flatMap((from) => destinations.filter((to) => to !== from).map((to) => ({ from, to })));

    try {
      const settled = await Promise.allSettled(
        routes.map(async ({ from, to }) => {
          const r = await passhub<{ offers?: FlightOffer[] }>("/searches", {
            method: "POST",
            keyName: "PASSHUB_AIR_API_KEY",
            body: {
              type: "flight",
              iataFrom: from,
              iataTo: to,
              adults: data.adults,
              ...(data.children ? { children: data.children } : {}),
              dates: [{ departure: data.date }],
              ravPercentage: 0,
              initialWaitSeconds: 40,
            },
          });
          return (r.offers ?? []).map((o, i) => mapFlightOffer(o, i, from, to));
        }),
      );

      const flights = settled
        .flatMap((result) => result.status === "fulfilled" ? result.value : [])
        .filter((flight, index, all) => {
          const key = `${flight.airline}|${flight.flightNumber}|${flight.from}|${flight.to}|${flight.departure}|${flight.price}`;
          return all.findIndex((other) => `${other.airline}|${other.flightNumber}|${other.from}|${other.to}|${other.departure}|${other.price}` === key) === index;
        })
        .sort((a, b) => a.price - b.price);

      if (flights.length) return { flights };

      const firstError = settled.find((result) => result.status === "rejected");
      return {
        flights: [],
        ...(firstError?.status === "rejected" ? { error: firstError.reason instanceof Error ? firstError.reason.message : "Nenhum voo encontrado." } : {}),
      };
    } catch (e) {
      return { flights: [], error: (e as Error).message };
    }
  });
