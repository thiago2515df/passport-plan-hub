import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const legSchema = z.object({
  direction: z.enum(["out", "back", "unknown"]),
  airline: z.string().max(80).default(""),
  flightNumber: z.string().max(30).default(""),
  from: z.string().max(8).default(""),
  to: z.string().max(8).default(""),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  arrivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  departure: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  arrival: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  duration: z.string().max(30).default(""),
  stops: z.string().max(80).default(""),
  travelClass: z.string().max(50).default(""),
  fareCategory: z.string().max(80).default(""),
  baggage: z.object({
    personal: z.boolean().nullable().default(null),
    carryOn: z.boolean().nullable().default(null),
    checked: z.boolean().nullable().default(null),
  }).default({ personal: null, carryOn: null, checked: null }),
});

const extractedSchema = z.object({
  legs: z.array(legSchema).min(1).max(4),
  totalPrice: z.number().nonnegative().nullable().default(null),
  perPersonPrice: z.number().nonnegative().nullable().default(null),
  currency: z.string().max(8).default("BRL"),
  confidence: z.number().min(0).max(1).default(0.5),
  notes: z.array(z.string().max(180)).max(8).default([]),
});

export type FlightImageExtraction = z.infer<typeof extractedSchema>;

const outputText = (payload: any) => {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const part of item?.content ?? []) {
      if (part?.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return "";
};

const normalizeDataUrl = (value: string) => {
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(value)) throw new Error("Envie uma imagem PNG, JPG ou WebP.");
  const comma = value.indexOf(",");
  const base64 = value.slice(comma + 1);
  if (base64.length > 8_000_000) throw new Error("A imagem é muito grande. Use uma captura com até aproximadamente 6 MB.");
  return value;
};

export const analyzeFlightImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    imageDataUrl: z.string().min(100),
    directionHint: z.enum(["out", "back", "auto"]).default("auto"),
  }).parse(input))
  .handler(async ({ data, context }): Promise<FlightImageExtraction> => {
    const { assertSearchPermission } = await import("./access.server");
    await assertSearchPermission(context.supabase, context.userId, "search_flights");

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("A leitura de voo por imagem ainda precisa do segredo OPENAI_API_KEY no servidor.");

    const imageDataUrl = normalizeDataUrl(data.imageDataUrl);
    const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-6-luna";
    const directionInstruction = data.directionHint === "out"
      ? "Esta imagem foi enviada no campo de IDA. Se houver apenas um trecho, classifique-o como out."
      : data.directionHint === "back"
        ? "Esta imagem foi enviada no campo de VOLTA. Se houver apenas um trecho, classifique-o como back."
        : "Identifique ida e volta pelo conteúdo visível.";

    const prompt = [
      "Extraia SOMENTE informações visíveis nesta captura de cotação/reserva aérea.",
      directionInstruction,
      "Não invente aeroportos, datas, horários, bagagem ou valores.",
      "Use códigos IATA de 3 letras somente quando estiverem visíveis (ex.: BSB, BPS).",
      "Datas devem sair em YYYY-MM-DD; horários em HH:MM.",
      "Se a imagem tiver ida e volta, devolva os dois trechos em legs.",
      "Se houver preço 'Total', 'Valor total' ou equivalente, coloque em totalPrice. Não some nem multiplique valores para criar um total que não esteja explícito.",
      "Se houver preço por pessoa explícito, coloque em perPersonPrice.",
      "Para stops use 'Direto' quando estiver explicitamente indicado; caso contrário preserve a informação visível ou deixe vazio.",
      "Bagagem: true apenas se claramente incluída; false apenas se claramente não incluída; null se não der para saber.",
      "Responda APENAS JSON válido no formato:",
      JSON.stringify({
        legs: [{
          direction: "out|back|unknown", airline: "", flightNumber: "", from: "", to: "",
          departureDate: "YYYY-MM-DD|null", arrivalDate: "YYYY-MM-DD|null",
          departure: "HH:MM|null", arrival: "HH:MM|null", duration: "", stops: "",
          travelClass: "", fareCategory: "",
          baggage: { personal: null, carryOn: null, checked: null },
        }],
        totalPrice: null, perPersonPrice: null, currency: "BRL", confidence: 0.0, notes: [],
      }),
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageDataUrl, detail: "high" },
          ],
        }],
        max_output_tokens: 1800,
      }),
    });

    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = raw?.error?.message || "A IA não conseguiu ler a imagem agora.";
      throw new Error(message);
    }

    const text = outputText(raw).trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/i, "");
    if (!text) throw new Error("A IA não retornou dados do voo.");
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new Error("A IA leu a imagem, mas não conseguiu estruturar os dados. Tente uma captura mais nítida."); }

    const result = extractedSchema.parse(parsed);
    if (!result.legs.some(leg => leg.from || leg.to || leg.flightNumber || leg.airline)) {
      throw new Error("Não consegui identificar um voo nessa imagem.");
    }
    return result;
  });
