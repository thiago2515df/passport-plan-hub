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
      // Paginate the 35-hotel PLP in small groups: at most seven paid PDP
      // lookups per click. This avoids the old 35-request burst/429/timeouts.
      const batchSize = 7;
      const batchesPerPlpPage = 5;
      const plpPage = Math.floor((data.page - 1) / batchesPerPlpPage) + 1;
      const position = ((data.page - 1) % batchesPerPlpPage) * batchSize;
      const result = await geckoTrivagoSearch({ ...data, page: plpPage });
      if (result.notFound || !result.data) return { listings: [], page: data.page };
      const nights = Math.max(1, Math.round((Date.parse(data.checkoutDate) - Date.parse(data.checkinDate)) / 86400000));
      const allCandidates = normalizeTrivagoItems(result.data.items ?? [], nights).filter(h => h.sourceUrl);
      const candidates = allCandidates.slice(position, position + batchSize);
      const nextPage = position + batchSize < allCandidates.length ? data.page + 1 :
        result.data.nextPage ? plpPage * batchesPerPlpPage + 1 : undefined;
      const listings: Hotel[] = [];
      const failures: string[] = [];
      // At most two in-flight PDP calls. Keep valid quotes even if other
      // hotels are unavailable; never substitute a forecasted PLP amount.
      for (let i = 0; i < candidates.length; i += 2) {
        const batch = await Promise.all(candidates.slice(i, i + 2).map(async hotel => {
          if (!hotel.sourceUrl) return null;
          try { return applyTrivagoStayPrice(hotel, await geckoTrivagoDetails(hotel.sourceUrl, data), data); }
          catch (error) {
            failures.push(error instanceof Error ? error.message : "Falha de consulta.");
            return null;
          }
        }));
        listings.push(...batch.filter((hotel): hotel is Hotel => hotel !== null));
        // Invalid token, no credits, or no access: stop further paid calls.
        if (failures.some(message => /créditos.*insuficientes|token.*inválido|não autorizado|não configurad/i.test(message))) break;
      }
      listings.sort((a, b) => a.total - b.total);
      if (!listings.length && failures.length) {
        const priority = failures.find(message => /créditos.*insuficientes|token.*inválido|não autorizado|não configurad/i.test(message));
        return { listings: [], page: data.page, ...(nextPage ? { nextPage } : {}),
          error: priority ?? "Não foi possível consultar preços de estadia dos fornecedores nesta etapa. " + failures[0] };
      }
      // Empty items without API failures mean the supplier has no dated
      // pricePerStay for those hotels; the next group may still have deals.
      return { listings, page: data.page, ...(nextPage ? { nextPage } : {}) };
    } catch (error) {
      return { listings: [], page: data.page, error: error instanceof Error ? error.message : "Falha na busca Trivago." };
    }
  });
