import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Flight } from "./hotels";

export const searchFlights = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      from: z.string().regex(/^[A-Z]{3}$/),
      to: z.string().regex(/^[A-Z]{3}$/),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      adults: z.number().int().min(1).max(9),
      children: z.number().int().min(0).max(8),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<{ flights: Flight[]; error?: string }> => {
    const { passhub } = await import("./passhub.server");
    type Offer = {
      airline?: string; flightNumber?: string; departureLocation?: string; arrivalLocation?: string;
      departureTime?: string; arrivalTime?: string; totalFlightDuration?: string; stopCount?: number;
      totalPrice: number; serviceClass?: string; carryOnBaggageIncluded?: boolean;
      checkedBaggageIncluded?: boolean; checkedBaggageQuantity?: number;
    };
    try {
      const r = await passhub<{ offers?: Offer[] }>("/searches", {
        method: "POST",
        keyName: "PASSHUB_AIR_API_KEY",
        body: {
          type: "flight", iataFrom: data.from, iataTo: data.to, adults: data.adults,
          ...(data.children ? { children: data.children } : {}),
          dates: [{ departure: data.date }], ravPercentage: 0, initialWaitSeconds: 40,
        },
      });
      const time = (t?: string) => (t ?? "").slice(11, 16);
      const flights = (r.offers ?? []).map((o, i) => ({
        id: `${i}-${o.flightNumber ?? ""}-${o.departureTime ?? ""}`,
        airline: o.airline ?? "", flightNumber: o.flightNumber ?? "",
        from: o.departureLocation ?? data.from, to: o.arrivalLocation ?? data.to,
        departure: time(o.departureTime), arrival: time(o.arrivalTime),
        duration: (o.totalFlightDuration ?? "").replace(":", "h"),
        stops: o.stopCount ? `${o.stopCount} parada${o.stopCount > 1 ? "s" : ""}` : "Direto",
        price: o.totalPrice, travelClass: o.serviceClass ?? "",
        bags: o.checkedBaggageIncluded ? `${o.checkedBaggageQuantity || 1} mala despachada` : o.carryOnBaggageIncluded ? "Só bagagem de mão" : "Só item pessoal",
      }));
      flights.sort((a, b) => a.price - b.price);
      return { flights };
    } catch (e) {
      return { flights: [], error: (e as Error).message };
    }
  });
