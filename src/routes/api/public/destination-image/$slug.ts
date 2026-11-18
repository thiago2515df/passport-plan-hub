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
  const apiKey = process.env["AI_API_KEY"]?.trim();
  const baseUrl = cleanBaseUrl(process.env["AI_BASE_URL"]?.trim() || "https://ai.starimg.ru/v1");
  const model = process.env["AI_IMAGE_MODEL"]?.trim() || "gemini-3.1-flash-image";

  if (!apiKey) {
    console.error("[destination-image] AI_API_KEY is not configured");
    return null;
  }

  const prompt = [
    `Photorealistic premium travel photograph of ${city}, Brazil.`,
    "Show a recognizable authentic city landscape or landmark associated with the destination.",
    "Natural daylight or golden hour, elegant tourism campaign photography, realistic architecture and scenery.",
    "Wide cinematic composition designed as a website hero banner, with useful negative space for white title text on the left.",
    "No text, no logos, no watermark, no fictional landmarks, no collage."
  ].join(" ");

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: "1536x1024",
      response_format: "b64_json",
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error(`[destination-image] AI generation failed (${response.status}): ${raw.slice(0, 800)}`);
    await logAvailableImageModels(baseUrl, apiKey);
    return null;
  }

  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    console.error("[destination-image] AI returned invalid JSON");
    return null;
  }

  const item = json?.data?.[0] ?? json?.images?.[0] ?? null;
  const b64 =
    item?.b64_json ??
    item?.base64 ??
    item?.image_base64 ??
    json?.b64_json ??
    json?.image_base64;

  if (typeof b64 === "string" && b64.length > 100) {
    const normalized = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
    return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
  }

  const imageUrl = item?.url ?? item?.image_url ?? json?.url ?? json?.image_url;
  if (typeof imageUrl === "string" && /^https?:\/\//i.test(imageUrl)) {
    const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(45_000) });
    if (!imageResponse.ok) {
      console.error(`[destination-image] Generated image download failed: ${imageResponse.status}`);
      return null;
    }
    return new Uint8Array(await imageResponse.arrayBuffer());
  }

  console.error("[destination-image] AI response did not contain an image");
  await logAvailableImageModels(baseUrl, apiKey);
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
