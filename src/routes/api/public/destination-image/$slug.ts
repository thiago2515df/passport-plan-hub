import { createFileRoute } from "@tanstack/react-router";

const DESTINATION_IMAGE_COUNT = 3;

const toHex = (bytes: Uint8Array) => "\\x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => Uint8Array.from(hex.slice(2).match(/.{2}/g)!.map((h) => parseInt(h, 16)));

const imageCacheKey = (slug: string, variant: number) =>
  variant === 1 ? slug : `${slug}--${variant}`;

const promptVariation = (variant: number) => {
  const variations = [
    "Iconic wide city panorama, balanced skyline and destination landmarks, premium tourism editorial photography.",
    "Distinct street-level or waterfront perspective with recognizable local scenery, sophisticated travel magazine photography.",
    "Elevated scenic viewpoint at golden hour, broad sense of place, polished luxury travel campaign photography.",
  ];
  return variations[(variant - 1) % variations.length];
};

async function generateDestinationImage(city: string, variant: number): Promise<Uint8Array | null> {
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
    promptVariation(variant),
    "Show a recognizable authentic city landscape or landmark associated with the destination.",
    "Natural light, realistic architecture and scenery, inviting but believable colors.",
    "Wide cinematic 16:9 composition designed as a website hero banner, with useful negative space for white title text on the left.",
    `Create a composition clearly different from the other cached variants. This is variant ${variant} of ${DESTINATION_IMAGE_COUNT}.`,
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

async function ensureDestinationImages(slug: string, city: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const keys = Array.from({ length: DESTINATION_IMAGE_COUNT }, (_, index) => imageCacheKey(slug, index + 1));

  const { data, error } = await supabaseAdmin
    .from("destination_images")
    .select("slug")
    .in("slug", keys);

  if (error) {
    console.error("[destination-image] Cache index read failed", error.message);
  }

  const available = new Set((data ?? []).map((row) => row.slug));
  const missing = keys
    .map((key, index) => ({ key, variant: index + 1 }))
    .filter(({ key }) => !available.has(key));

  if (missing.length) {
    const generated = await Promise.all(
      missing.map(async ({ key, variant }) => {
        const bytes = await generateDestinationImage(city, variant);
        if (!bytes) return null;

        const { error: saveError } = await supabaseAdmin
          .from("destination_images")
          .upsert({ slug: key, content: toHex(bytes) }, { onConflict: "slug" });

        if (saveError) {
          console.error(`[destination-image] Cache save failed for variant ${variant}`, saveError.message);
          return null;
        }

        return key;
      }),
    );

    for (const key of generated) {
      if (key) available.add(key);
    }
  }

  return keys.filter((key) => available.has(key));
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

        const city = slug
          .split("-")
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");

        const availableKeys = await ensureDestinationImages(slug, city);
        if (!availableKeys.length) return new Response("Not found", { status: 404 });

        const selectedKey = availableKeys[Math.floor(Math.random() * availableKeys.length)]!;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("destination_images")
          .select("content")
          .eq("slug", selectedKey)
          .maybeSingle();

        if (error || !data?.content) {
          console.error("[destination-image] Cached image read failed", error?.message ?? selectedKey);
          return new Response("Not found", { status: 404 });
        }

        const hex = String(data.content);
        if (!hex.startsWith("\\x")) return new Response("Not found", { status: 404 });
        const bytes = fromHex(hex);

        return new Response(bytes.buffer as ArrayBuffer, {
          headers: {
            "Content-Type": "image/png",
            // The endpoint is intentionally not cached because it randomly selects
            // one of the three permanent cached variants for each proposal load.
            "Cache-Control": "no-store, max-age=0",
          },
        });
      },
    },
  },
});
