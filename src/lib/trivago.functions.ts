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
  .handler(async ({ data, context }): Promise<{ listings: Hotel[]; page: number; nextPage?: number; error?: string; warning?: string }> => {
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
      // Each group has at most seven listings and two simultaneous PDP calls.
      // A failed hotel's name and image are still shown, without a fake price.
      for (let i = 0; i < candidates.length; i += 2) {
        const batch = await Promise.all(candidates.slice(i, i + 2).map(async hotel => {
          if (!hotel.sourceUrl) return { ...hotel, quoteError: "URL pública indisponível." };
          try {
            const details = await geckoTrivagoDetails(hotel.sourceUrl, data);
            const result = applyTrivagoStayPrice(hotel, details, data);
            return result ?? { ...hotel, quoteError: "Fornecedor não informou preço total de estadia para as datas escolhidas." };
          } catch (error) {
            const reason = error instanceof Error ? error.message : "Falha na consulta do fornecedor.";
            failures.push(reason);
            return { ...hotel, quoteError: reason };
          }
        }));
        listings.push(...batch);
        // Stop after denied/unauthorized requests, but keep all already found
        // hotels visible. The user can inspect details or try a new period.
        if (failures.some(message => /créditos.*insuficientes|token.*inválido|não autorizado|não configurad/i.test(message))) break;
      }
      const priced = listings.filter(h => h.total > 0);
      // A source price isn't a guaranteed checkout price, so the seller must
      // continue to confirm taxes and availability before generating a link.
      listings.sort((a, b) =>
        (a.total > 0 ? 0 : 1) - (b.total > 0 ? 0 : 1) ||
        (a.total > 0 && b.total > 0 ? a.total - b.total : a.name.localeCompare(b.name, "pt-BR"))
      );
      const priority = failures.find(message => /créditos.*insuficientes|token.*inválido|não autorizado|não configurad/i.test(message));
      const warning = !priority && failures.length
        ? `Não foi possível consultar ${failures.length} ${failures.length === 1 ? "hotel" : "hotéis"} deste grupo. Confira a mensagem em cada resultado e tente novamente.`
        : undefined;
      return {
        listings, page: data.page,
        ...(nextPage ? { nextPage } : {}),
        ...(priority ? { error: priority } : {}),
        ...(warning ? { warning } : {}),
      };
    } catch (error) {
      return { listings: [], page: data.page, error: error instanceof Error ? error.message : "Falha na busca Trivago." };
    }
  });

/** Request one hotel's dated supplier prices on demand, without PLP forecasts. */
export const refreshTrivagoQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(value => z.object({
    id: z.string().regex(/^trivago:\d+:\d+$/),
    url: z.string().url(),
    checkinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkoutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    numAdults: z.number().int().min(1).max(30),
    numChildren: z.number().int().min(0).max(30),
    numRooms: z.number().int().min(1).max(15),
  }).refine(v => v.checkoutDate > v.checkinDate, "Check-out deve ser posterior ao check-in.").parse(value))
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./access.server");
    await assertPermission(context.supabase, "search_hotels");
    const { geckoTrivagoDetails } = await import("./gecko-trivago.server");
    const { applyTrivagoStayPrice, normalizeTrivagoItems } = await import("./trivago-adapter");
    const id = Number(data.id.split(":")[2]);
    const nights = Math.round((Date.parse(data.checkoutDate) - Date.parse(data.checkinDate)) / 86400000);
    const seed = normalizeTrivagoItems([{ id, url: data.url }], nights)[0];
    if (!seed?.sourceUrl) return { error: "Endereço Trivago inválido." };
    try {
      const details = await geckoTrivagoDetails(seed.sourceUrl, data);
      const quote = applyTrivagoStayPrice(seed, details, data);
      if (!quote) return { error: "O fornecedor não informou preço total de estadia para essas datas. Verifique o anúncio." };
      return { total: quote.total, nightly: quote.nightly, supplierName: quote.supplierName, room: quote.room };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Falha ao consultar tarifa." };
    }
  });
