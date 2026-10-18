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
      const { geckoTrivagoSearch } = await import("./gecko-trivago.server");
      const { normalizeTrivagoItems } = await import("./trivago-adapter");
      const result = await geckoTrivagoSearch(data);
      if (result.notFound || !result.data) return { listings: [], page: data.page };
      const nights = Math.max(1, Math.round((Date.parse(data.checkoutDate) - Date.parse(data.checkinDate)) / 86400000));
      const listings = normalizeTrivagoItems(result.data.items ?? [], nights);
      return { listings, page: result.data.page ?? data.page, ...(result.data.nextPage ? { nextPage: result.data.nextPage } : {}) };
    } catch (error) {
      return { listings: [], page: data.page, error: error instanceof Error ? error.message : "Falha na busca Trivago." };
    }
  });
