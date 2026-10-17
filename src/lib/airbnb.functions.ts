import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Hotel } from "./hotels";
import { nightsBetween } from "./hotels";

function parseBrlTotal(label?: string) {
  if (!label) return undefined;
  const match = label.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/i);
  if (!match?.[1]) return undefined;
  const normalized = match[1].replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

export const searchAirbnb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => z.object({
    destination: z.string().min(2).max(120),
    checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    adults: z.number().int().min(1).max(9),
    page: z.number().int().min(1).max(50).default(1),
  }).parse(value))
  .handler(async ({ data, context }): Promise<{ listings: Hotel[]; totalResults: number; page: number; nextPage?: number; error?: string }> => {
    const { assertPermission } = await import("./access.server");
    await assertPermission(context.supabase, "search_hotels");
    const { geckoAirbnbSearch } = await import("./gecko-airbnb.server");
    try {
      const response = await geckoAirbnbSearch({
        address: data.destination,
        startDate: data.checkin,
        endDate: data.checkout,
        numAdults: data.adults,
        page: data.page,
      });
      if (response.notFound || !response.data) return { listings: [], totalResults: 0, page: data.page };
      const items = response.data.items ?? [];
      const nights = nightsBetween(data.checkin, data.checkout);
      const lats = items.map((item) => item.latitude).filter((value): value is number => typeof value === "number");
      const lngs = items.map((item) => item.longitude).filter((value): value is number => typeof value === "number");
      const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
      const pos = (value: number | undefined, min: number, max: number, invert = false) => {
        if (typeof value !== "number" || !Number.isFinite(min) || !Number.isFinite(max) || max === min) return 50;
        const ratio = (value - min) / (max - min);
        return 8 + (invert ? 1 - ratio : ratio) * 84;
      };
      const listings: Hotel[] = items.map((item) => {
        const nightly = Math.max(0, Number(item.price ?? 0));
        const parsedTotal = parseBrlTotal(item.totalPriceLabel);
        const total = parsedTotal ?? nightly * nights;
        const images = (item.images ?? []).map((image) => image.url ?? "").filter(Boolean);
        const highlights = item.highlights ?? [];
        return {
          id: `airbnb:${item.listingId}`,
          provider: "airbnb",
          providerListingId: item.listingId,
          sourceUrl: item.url,
          name: item.name || item.title || "Airbnb",
          address: [item.category, item.city].filter(Boolean).join(" · "),
          stars: 0,
          rating: item.aggregateRating?.rating,
          reviewCount: item.aggregateRating?.reviewCount,
          nightly,
          total,
          room: highlights.join(" · "),
          image: item.thumbnail || images[0] || "",
          images,
          x: pos(item.longitude, minLng, maxLng),
          y: pos(item.latitude, minLat, maxLat, true),
        };
      });
      return {
        listings,
        totalResults: response.data.totalResults ?? listings.length,
        page: response.data.page ?? data.page,
        ...(response.data.nextPage ? { nextPage: response.data.nextPage } : {}),
      };
    } catch (error) {
      return { listings: [], totalResults: 0, page: data.page, error: error instanceof Error ? error.message : "Não foi possível consultar o Airbnb." };
    }
  });
