import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Hotel } from "./hotels";

export const searchTrivago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(value => z.object({
    location: z.string().trim().min(2).max(120),
    checkinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkoutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    numAdults: z.number().int().min(1).max(30),
    numChildren: z.number().int().min(0).max(30),
    numRooms: z.number().int().min(1).max(15),
    page: z.number().int().min(1).max(50).default(1),
  }).refine(d => d.checkoutDate > d.checkinDate, "A volta deve ser posterior à ida.").parse(value))
  .handler(async ({ data, context }): Promise<{ listings: Hotel[]; page: number; nextPage?: number; error?: string }> => {
    const { assertPermission } = await import("./access.server");
    await assertPermission(context.supabase, "search_hotels");
    try {
      const { geckoTrivagoSearch, geckoTrivagoDetails } = await import("./gecko-trivago.server");
      const { normalizeTrivagoItems, applyTrivagoStayPrice } = await import("./trivago-adapter");
      const result = await geckoTrivagoSearch(data);
      if (result.notFound || !result.data) return { listings: [], page: data.page };
      const nights = Math.max(1, Math.round((Date.parse(data.checkoutDate) - Date.parse(data.checkinDate)) / 86400000));
      const candidates = normalizeTrivagoItems(result.data.items ?? [], nights).filter(h => h.sourceUrl);
      const listings: Hotel[] = [];
      let failed = false;
      // Bound paid supplier lookups; a forecast is never a fallback price.
      for (let i = 0; i < candidates.length; i += 5) {
        const batch = await Promise.all(candidates.slice(i, i + 5).map(async hotel => {
          if (!hotel.sourceUrl) return null;
          try { return applyTrivagoStayPrice(hotel, await geckoTrivagoDetails(hotel.sourceUrl, data), data); }
          catch { failed = true; return null; }
        }));
        listings.push(...batch.filter((hotel): hotel is Hotel => hotel !== null));
      }
      listings.sort((a, b) => a.total - b.total);
      if (!listings.length && failed) return { listings: [], page: data.page, error: "Não foi possível obter os totais dos fornecedores. Tente novamente; nenhuma previsão foi usada como preço." };
      return { listings, page: result.data.page ?? data.page, ...(result.data.nextPage ? { nextPage: result.data.nextPage } : {}) };
    } catch (error) {
      return { listings: [], page: data.page, error: error instanceof Error ? error.message : "Falha na busca Trivago." };
    }
  });
