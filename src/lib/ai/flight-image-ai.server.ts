import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayRunIdFetch } from "./run-id.ts";

const LOVABLE_AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const FLIGHT_IMAGE_MODEL = "openai/gpt-6-astra";

const baggageSchema = z.strictObject({
  personal: z.boolean().nullable(),
  carryOn: z.boolean().nullable(),
  checked: z.boolean().nullable(),
});

const legSchema = z.strictObject({
  direction: z.enum(["out", "back", "unknown"]),
  airline: z.string().nullable(),
  flightNumber: z.string().nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  departureDate: z.string().nullable(),
  arrivalDate: z.string().nullable(),
  departure: z.string().nullable(),
  arrival: z.string().nullable(),
  duration: z.string().nullable(),
  stops: z.string().nullable(),
  travelClass: z.string().nullable(),
  fareCategory: z.string().nullable(),
  baggage: baggageSchema,
});

const extractionSchema = z.strictObject({
  legs: z.array(legSchema),
  totalPrice: z.number().nullable(),
  perPersonPrice: z.number().nullable(),
  currency: z.string().nullable(),
  confidence: z.number().nullable(),
  notes: z.array(z.string()),
});

export type FlightImageAiExtraction = z.infer<typeof extractionSchema>;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const statusOf = (error: unknown): number | undefined => {
  const candidate = error as { statusCode?: unknown; status?: unknown };
  const value = candidate?.statusCode ?? candidate?.status;
  return typeof value === "number" ? value : undefined;
};

const safeDetail = (error: unknown): string | undefined => {
  const message = error instanceof Error ? error.message.trim() : undefined;
  return message && message.length > 0 && message.length <= 400 ? message : undefined;
};

const toUserError = (error: unknown, status: number | undefined): Error => {
  const detail = safeDetail(error);
  if (status === 401) return new Error("A IA do Lovable não está configurada neste projeto.");
  if (status === 402) return new Error(detail || "Créditos de IA insuficientes. Peça ao administrador para reabastecer os créditos.");
  if (status === 403) return new Error(detail || "O acesso à IA do Lovable está bloqueado para este espaço de trabalho.");
  if (status === 404) return new Error("O modelo de IA usado na leitura de imagens não está disponível.");
  if (status === 429) return new Error("A IA está muito solicitada agora. Tente novamente em alguns instantes.");
  if (status != null && status >= 500) return new Error("A IA do Lovable está indisponível no momento. Tente novamente em instantes.");
  if (status === 400) return new Error("A IA não conseguiu processar esta imagem. Tente uma captura mais nítida.");
  return new Error("A IA não conseguiu ler a imagem agora.");
};

export async function extractFlightFromImage({
  imageDataUrl,
  directionHint,
}: {
  imageDataUrl: string;
  directionHint: "out" | "back" | "auto";
}): Promise<FlightImageAiExtraction> {
  const apiKey = process.env.LOVABLE_API_KEY?.trim();
  if (!apiKey) throw new Error("A IA do Lovable ainda não está disponível neste projeto.");

  const directionInstruction = directionHint === "out"
    ? "Esta imagem foi enviada no campo de IDA. Se houver apenas um trecho, classifique-o como out."
    : directionHint === "back"
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
    "Deixe null qualquer campo que não esteja visível na imagem.",
  ].join("\n");

  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      await sleep(Math.min(8_000, 700 * 2 ** (attempt - 2)) + Math.floor(Math.random() * 400));
    }
    try {
      const runIdFetch = createLovableAiGatewayRunIdFetch(undefined);
      const provider = createOpenAI({
        baseURL: LOVABLE_AI_GATEWAY_URL,
        apiKey,
        headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        fetch: runIdFetch.fetch,
      });
      const result = streamText({
        model: provider.responses(FLIGHT_IMAGE_MODEL),
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: new URL(imageDataUrl) },
          ],
        }],
        output: Output.object({ schema: extractionSchema }),
        providerOptions: {
          openai: {
            store: false,
            forceReasoning: true,
            reasoningEffort: "medium",
            reasoningSummary: "auto",
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      return await result.output;
    } catch (error) {
      lastError = error;
      const status = statusOf(error);
      const retryable = status === 429 || (status != null && status >= 500 && status <= 599);
      if (!retryable || attempt === maxAttempts) throw toUserError(error, status);
    }
  }
  throw toUserError(lastError, statusOf(lastError));
}
