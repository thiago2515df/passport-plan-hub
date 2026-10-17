import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Hotel, AirbnbPropertyDetails } from "./hotels";
import { nightsBetween } from "./hotels";
import { geckoAirbnbPrice } from "./gecko-price";

export const searchAirbnb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => z.object({
    destination: z.string().min(2).max(120),
    checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    adults: z.number().int().min(1).max(30),
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
      const listings: Hotel[] = items.flatMap((item) => {
        // Never advertise an unknown or foreign-currency price as R$ 0,00.
        const price = geckoAirbnbPrice(item, nights);
        if (!item.listingId?.trim() || !price) return [];
        const images = (item.images ?? []).map((image) => image.url ?? "").filter(Boolean);
        const highlights = item.highlights ?? [];
        return [{
          id: `airbnb:${item.listingId}`,
          provider: "airbnb" as const,
          providerListingId: item.listingId,
          sourceUrl: item.url,
          name: item.name || item.title || "Airbnb",
          address: [item.category, item.city].filter(Boolean).join(" · "),
          stars: 0,
          rating: item.aggregateRating?.rating,
          reviewCount: item.aggregateRating?.reviewCount,
          nightly: price.nightly,
          total: price.total,
          totalEstimated: price.totalEstimated,
          room: highlights.join(" · "),
          image: item.thumbnail || images[0] || "",
          images,
          x: pos(item.longitude, minLng, maxLng),
          y: pos(item.latitude, minLat, maxLat, true),
        }];
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

/**
 * Details are fetched only when a user opens an Airbnb apartment.
 * PLP listings contain thumbnails, but the PDP response carries the
 * description, complete image array, amenities and cancellation policy.
 */
export const getAirbnbDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => z.object({
    listingId: z.string().regex(/^\d{6,22}$/),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    numAdults: z.number().int().min(1).max(30).optional(),
  }).parse(value))
  .handler(async ({ data, context }): Promise<AirbnbPropertyDetails & { error?: string }> => {
    const { assertPermission } = await import("./access.server");
    await assertPermission(context.supabase, "search_hotels");
    try {
      const { geckoAirbnbDetails } = await import("./gecko-airbnb.server");
      const response = await geckoAirbnbDetails(data);
      const { normalizeAirbnbPdp } = await import("./airbnb-pdp-details");
      const details = normalizeAirbnbPdp(response);
      if (!details) {
        return { photos: [], description: "", amenities: [], highlights: [],
          propertyType: "", cancellationPolicy: "", hostName: "",
          error: "Detalhes deste imóvel não disponíveis na GeckoAPI." };
      }
      return details;
    } catch (error) {
      return { photos: [], description: "", amenities: [], highlights: [],
        propertyType: "", cancellationPolicy: "", hostName: "",
        error: error instanceof Error ? error.message : "Não foi possível consultar os detalhes Airbnb." };
    }
  });
