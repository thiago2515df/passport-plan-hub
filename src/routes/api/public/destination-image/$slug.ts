import { createFileRoute } from "@tanstack/react-router";

const toHex = (bytes: Uint8Array) => "\\x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => Uint8Array.from(hex.slice(2).match(/.{2}/g)!.map((h) => parseInt(h, 16)));

const cleanBaseUrl = (value: string) => value.replace(/\/+$/, "");

async function logAvailableImageModels(baseUrl: string, apiKey: string) {
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      console.error(`[destination-image] Could not list AI STAR models: HTTP ${response.status}`);
      return;
    }
    const json = await response.json() as { data?: Array<{ id?: string }> };
    const ids = (json.data ?? []).map(item => item.id).filter((id): id is string => Boolean(id));
    const candidates = ids.filter(id => /image|imagen|gemini|flash|nano|banana/i.test(id));
    console.error("[destination-image] Available image/Gemini model candidates:", candidates.slice(0, 80).join(", ") || "(none)");
  } catch (error) {
    console.error("[destination-image] Model discovery failed:", error instanceof Error ? error.message : String(error));
  }
}

async function generateDestinationImage(city: string): Promise<Uint8Array | null> {
  const apiKey = (
    process.env["FLATKEY_IMAGE_API_KEY"] ??
    process.env["FLATKEY_API_KEY"]
  )?.trim();
  const model = process.env["FLATKEY_IMAGE_MODEL"]?.trim() || "gemini-3.1-flash-image";

  if (!apiKey) {
    console.error("[destination-image] FLATKEY_IMAGE_API_KEY is not configured");
    return null;
  }

  const prompt = [
    `Photorealistic premium travel photograph of ${city}, Brazil.`,
    "Show a recognizable authentic city landscape or landmark associated with the destination.",
    "Natural daylight or golden hour, elegant tourism campaign photography, realistic architecture and scenery.",
    "Wide cinematic 16:9 composition designed as a website hero banner, with useful negative space for white title text on the left.",
    "No text, no logos, no watermark, no fictional landmarks, no collage."
  ].join(" ");

  const endpoint = `https://router.flatkey.ai/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: prompt }],
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error(`[destination-image] Flatkey Gemini generation failed (${response.status}): ${raw.slice(0, 1500)}`);
    return null;
  }

  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    console.error("[destination-image] Flatkey returned invalid JSON");
    return null;
  }

  const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const inline = part?.inlineData ?? part?.inline_data;
      const b64 = inline?.data;
      const mimeType = inline?.mimeType ?? inline?.mime_type;
      if (typeof b64 === "string" && b64.length > 100 && (!mimeType || /^image\//i.test(String(mimeType)))) {
        const normalized = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
        return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
      }
    }
  }

  console.error("[destination-image] Flatkey Gemini response did not contain inline image data");
  console.error("[destination-image] Response preview:", raw.slice(0, 1800));
  return null;
}

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
        const { data, error: readError } = await supabaseAdmin
          .from("destination_images")
          .select("content")
          .eq("slug", slug)
          .maybeSingle();

        if (readError) {
          console.error("[destination-image] Cache read failed", readError.message);
        }

        let bytes: Uint8Array | null = null;
        if (data?.content) {
          const hex = String(data.content);
          if (hex.startsWith("\\x")) bytes = fromHex(hex);
        }

        if (!bytes) {
          const city = slug
            .split("-")
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");

          bytes = await generateDestinationImage(city);
          if (!bytes) return new Response("Not found", { status: 404 });

          const { error: saveError } = await supabaseAdmin
            .from("destination_images")
            .upsert({ slug, content: toHex(bytes) }, { onConflict: "slug" });

          if (saveError) {
            console.error("[destination-image] Cache save failed", saveError.message);
          }
        }

        return new Response(bytes.buffer as ArrayBuffer, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
