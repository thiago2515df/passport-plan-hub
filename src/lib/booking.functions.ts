import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Hotel } from "./hotels";

const period = z.object({
  checkinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkoutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numAdults: z.number().int().min(1).max(30),
  numChildren: z.number().int().min(0).max(30),
  childAges: z.array(z.number().int().min(0).max(17)),
  numRooms: z.literal(1),
});
const validPeriod = (d: z.infer<typeof period>) => d.checkoutDate > d.checkinDate && d.numChildren === d.childAges.length;
export const searchBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(value => period.extend({ location: z.string().trim().min(2).max(200), cursor: z.string().max(12000).optional() }).refine(validPeriod, "Confira as datas e idades dos hóspedes.").parse(value))
  .handler(async ({ data, context }): Promise<{ listings: Hotel[]; nextPage?: string; warning?: string; error?: string }> => {
    const { assertSearchPermission } = await import("./access.server");
    await assertSearchPermission(context.supabase, context.userId, "search_hotels");
    try { const { bookingSearch } = await import("./staying-booking.server"); return await bookingSearch(data); }
    catch (e) { return { listings: [], error: e instanceof Error ? e.message : "Falha na busca Booking.com." }; }
  });
export const refreshBookingQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(value => period.extend({ listingId: z.string().min(1).max(300) }).refine(validPeriod).parse(value))
  .handler(async ({ data, context }): Promise<{ total?: number; nightly?: number; supplierName?: string; room?: string; error?: string }> => {
    const { assertSearchPermission } = await import("./access.server");
    await assertSearchPermission(context.supabase, context.userId, "search_hotels");
    try { const { bookingQuote } = await import("./staying-booking.server"); return await bookingQuote(data); }
    catch (e) { return { error: e instanceof Error ? e.message : "Falha ao consultar tarifa." }; }
  });
export const getBookingDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(value => z.object({ listingId: z.string().min(1).max(300) }).parse(value))
  .handler(async ({ data, context }) => {
    const { assertSearchPermission } = await import("./access.server");
    await assertSearchPermission(context.supabase, context.userId, "search_hotels");
    const { bookingDetails } = await import("./staying-booking.server");
    return bookingDetails(data.listingId);
  });
