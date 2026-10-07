import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// The two independent random UUIDs form a bearer capability. No listing is exposed.
export const ticketPath = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpg|webp)$/);
export const viewTicket = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ path: ticketPath }).parse(data))
  .handler(async ({ data }) => {
    // Possession of the unguessable path authorizes only this single shared attachment.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage.from("proposal-tickets").createSignedUrl(data.path, 600);
    if (error || !signed) throw new Error("Não foi possível abrir a passagem.");
    return { url: signed.signedUrl };
  });