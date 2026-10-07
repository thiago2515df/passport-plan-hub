import { createFileRoute } from "@tanstack/react-router";

const toHex = (bytes: Uint8Array) => "\\x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => Uint8Array.from(hex.slice(2).match(/.{2}/g)!.map((h) => parseInt(h, 16)));

export const Route = createFileRoute("/api/public/destination-image/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = (params.slug ?? "")
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60);
        if (!slug) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.from("destination_images").select("content").eq("slug", slug).maybeSingle();

        let bytes: Uint8Array | null = null;
        if (data?.content) {
          const hex = String(data.content);
          if (hex.startsWith("\\x")) bytes = fromHex(hex);
        }

        if (!bytes) {
          const apiKey = process.env["LOVABLE_API_KEY"];
          if (!apiKey) return new Response("Not found", { status: 404 });
          const city = slug.replace(/-/g, " ");
          const prompt = `Breathtaking realistic travel photograph of ${city}, Brazil, iconic landmark scenery, golden hour light, professional tourism photography, high detail, no text, no watermark`;
          const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "openai/gpt-image-2.5-sunburst", prompt, size: "1536x1024", quality: "medium" }),
          });
          if (!res.ok) return new Response("Not found", { status: 404 });
          const json = (await res.json()) as { data?: { b64_json?: string }[] };
          const b64 = json?.data?.[0]?.b64_json;
          if (!b64) return new Response("Not found", { status: 404 });
          bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          await supabaseAdmin.from("destination_images").upsert({ slug, content: toHex(bytes) });
        }

        return new Response(bytes.buffer as ArrayBuffer, {
          headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800, immutable" },
        });
      },
    },
  },
});
