import { createOpenAI } from "@ai-sdk/openai";
import { Output, generateText } from "ai";
import { z } from "zod";

const AI_MODEL = process.env["FREELLMAPI_MODEL"]?.trim() || "auto";
const AI_IMAGE_MODEL = process.env["FREELLMAPI_IMAGE_MODEL"]?.trim() || "qwen/qwen3.8-27b";
const AI_BASE_URL = process.env["FREELLMAPI_BASE_URL"]?.trim() || "http://freellmapi:3001/v1";

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

const isLegIncomplete = (leg: FlightImageAiExtraction["legs"][number]) =>
  !leg.from ||
  !leg.to ||
  !leg.departureDate ||
  !leg.departure ||
  !leg.arrival ||
  !leg.flightNumber ||
  !leg.airline;

const needsImageSecondPass = (result: FlightImageAiExtraction) =>
  result.legs.length === 0 ||
  result.legs.some(isLegIncomplete);

const mergeValue = <T>(primary: T | null | undefined, secondary: T | null | undefined): T | null =>
  primary != null && primary !== "" ? primary : secondary != null ? secondary : null;

const mergeExtractions = (
  first: FlightImageAiExtraction,
  second: FlightImageAiExtraction,
): FlightImageAiExtraction => {
  const maxLegs = Math.max(first.legs.length, second.legs.length);
  const legs = Array.from({ length: maxLegs }, (_, index) => {
    const a = first.legs[index];
    const b = second.legs[index];
    if (!a) return b!;
    if (!b) return a;
    return {
      direction: a.direction !== "unknown" ? a.direction : b.direction,
      airline: mergeValue(a.airline, b.airline),
      flightNumber: mergeValue(a.flightNumber, b.flightNumber),
      from: mergeValue(a.from, b.from),
      to: mergeValue(a.to, b.to),
      departureDate: mergeValue(a.departureDate, b.departureDate),
      arrivalDate: mergeValue(a.arrivalDate, b.arrivalDate),
      departure: mergeValue(a.departure, b.departure),
      arrival: mergeValue(a.arrival, b.arrival),
      duration: mergeValue(a.duration, b.duration),
      stops: mergeValue(a.stops, b.stops),
      travelClass: mergeValue(a.travelClass, b.travelClass),
      fareCategory: mergeValue(a.fareCategory, b.fareCategory),
      baggage: {
        personal: a.baggage.personal ?? b.baggage.personal,
        carryOn: a.baggage.carryOn ?? b.baggage.carryOn,
        checked: a.baggage.checked ?? b.baggage.checked,
      },
    };
  });

  return {
    legs,
    totalPrice: first.totalPrice ?? second.totalPrice,
    perPersonPrice: first.perPersonPrice ?? second.perPersonPrice,
    currency: first.currency ?? second.currency,
    confidence: Math.max(first.confidence ?? 0, second.confidence ?? 0),
    notes: Array.from(new Set([...(first.notes ?? []), ...(second.notes ?? [])])).slice(0, 8),
  };
};

const statusOf = (error: unknown): number | undefined => {
  const candidate = error as { statusCode?: unknown; status?: unknown };
  const value = candidate?.statusCode ?? candidate?.status;
  return typeof value === "number" ? value : undefined;
};

const safeDetail = (error: unknown): string | undefined => {
  const message = error instanceof Error ? error.message.trim() : undefined;
  return message && message.length > 0 && message.length <= 500 ? message : undefined;
};

const toUserError = (error: unknown, status: number | undefined): Error => {
  const detail = safeDetail(error);
  if (status === 401) return new Error("A chave unificada do FreeLLMAPI não foi aceita. Confira FREELLMAPI_API_KEY.");
  if (status === 403) return new Error(detail || "O FreeLLMAPI recusou o acesso ao modelo configurado.");
  if (status === 404) return new Error("O modelo configurado não está disponível no catálogo do FreeLLMAPI.");
  if (status === 422 && /no_vision_model/i.test(detail ?? "")) return new Error("Nenhum modelo com visão está ativo no FreeLLMAPI. Ative um modelo Vision no painel.");
  if (status === 429) return new Error("Os modelos disponíveis no FreeLLMAPI estão temporariamente em limite/cooldown. Tente novamente em instantes ou adicione mais chaves de provedores.");
  if (status != null && status >= 500) return new Error("O FreeLLMAPI ou o provedor de IA está indisponível no momento. Tente novamente em instantes.");
  if (status === 400) return new Error(detail || "A IA não conseguiu processar este conteúdo. Tente uma captura mais nítida.");
  return new Error(detail || "A IA não conseguiu ler o conteúdo agora.");
};


function extractionPrompt(directionHint: "out" | "back" | "auto", source: "imagem" | "texto") {
  const directionInstruction = directionHint === "out"
    ? "Este conteúdo foi enviado no campo de IDA. Se houver apenas um trecho, classifique-o como out."
    : directionHint === "back"
      ? "Este conteúdo foi enviado no campo de VOLTA. Se houver apenas um trecho, classifique-o como back."
      : "Identifique ida e volta pelo conteúdo disponível.";

  return [
    `Extraia SOMENTE informações realmente presentes neste ${source} de cotação/reserva/passagem aérea.`,
    directionInstruction,
    "Não invente aeroportos, datas, horários, bagagem, companhia, número do voo ou valores.",
    "IMPORTANTE: identifique a companhia também pelo prefixo do número do voo quando ele estiver visível. Mapeamentos obrigatórios: LA ou JJ = LATAM Airlines; G3 = GOL Linhas Aéreas; AD = Azul Linhas Aéreas; 2Z = Voepass; TP = TAP Air Portugal; AR = Aerolíneas Argentinas; AV = Avianca; CM = Copa Airlines.",
    "Se a interface mostrar um nome de operadora genérico ou incorreto, mas o número do voo tiver um prefixo conhecido, priorize o prefixo IATA do voo para preencher airline.",
    "Exemplo: 'LA-4724' ou 'LA 4724' deve retornar airline='LATAM Airlines' e flightNumber='LA 4724'.",
    "Use códigos IATA de 3 letras apenas quando estiverem presentes ou quando o texto trouxer claramente o aeroporto junto do código.",
    "Datas devem sair em YYYY-MM-DD; horários em HH:MM.",
    "Se houver ida e volta, devolva os dois trechos em legs.",
    "Se houver preço 'Total', 'Valor total' ou equivalente, coloque em totalPrice. Não some nem multiplique valores para criar um total que não esteja explícito.",
    "Se houver preço por pessoa explícito, coloque em perPersonPrice.",
    "Para stops use 'Direto' apenas quando estiver explicitamente indicado; caso contrário preserve a informação visível ou deixe vazio.",
    "Bagagem: true apenas se claramente incluída; false apenas se claramente não incluída; null se não der para saber.",
    "Deixe null qualquer campo ausente ou duvidoso.",
  ].join("\n");
}

async function runExtraction({
  content,
  model = AI_MODEL,
}: {
  content: Array<{ type: "text"; text: string } | { type: "image"; image: URL }>;
  model?: string;
}): Promise<FlightImageAiExtraction> {
  const apiKey = process.env["FREELLMAPI_API_KEY"]?.trim();
  if (!apiKey) {
    throw new Error("A leitura com IA ainda não está configurada. Cadastre FREELLMAPI_API_KEY no servidor.");
  }

  const provider = createOpenAI({ apiKey, baseURL: AI_BASE_URL });
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) await sleep(Math.min(5_000, 700 * 2 ** (attempt - 2)));
    try {
      const result = await generateText({
        model: provider.chat(model),
        messages: [{ role: "user", content }],
        output: Output.object({ schema: extractionSchema }),
        providerOptions: { openai: { store: false } },
      });
      return result.output;
    } catch (error) {
      lastError = error;
      const status = statusOf(error);
      const retryable = status === 429 || (status != null && status >= 500 && status <= 599);
      if (!retryable || attempt === maxAttempts) throw toUserError(error, status);
    }
  }
  throw toUserError(lastError, statusOf(lastError));
}

export async function extractFlightFromText({
  text,
  directionHint,
}: {
  text: string;
  directionHint: "out" | "back" | "auto";
}): Promise<FlightImageAiExtraction> {
  const clean = text.trim();
  if (!clean) throw new Error("Cole a mensagem ou os dados da passagem.");
  if (clean.length > 20_000) throw new Error("O texto é muito grande. Envie apenas a parte da cotação ou passagem.");
  return runExtraction({
    content: [{ type: "text", text: `${extractionPrompt(directionHint, "texto")}\n\nCONTEÚDO PARA LER:\n${clean}` }],
  });
}

export async function extractFlightFromImage({
  imageDataUrl,
  directionHint,
}: {
  imageDataUrl: string;
  directionHint: "out" | "back" | "auto";
}): Promise<FlightImageAiExtraction> {
  const image = new URL(imageDataUrl);
  const first = await runExtraction({
    model: AI_IMAGE_MODEL,
    content: [
      {
        type: "text",
        text: [
          extractionPrompt(directionHint, "imagem"),
          "LEIA A IMAGEM INTEIRA, inclusive colunas laterais e linhas pequenas.",
          "Antes de finalizar, confira especificamente: origem, destino, data de saída, data de chegada, horário de saída, horário de chegada, duração, número do voo, companhia, classe/tarifa, bagagens e valores.",
          "Não deixe um campo vazio se ele estiver legível na imagem.",
        ].join("\n"),
      },
      { type: "image", image },
    ],
  });

  if (!needsImageSecondPass(first)) return first;

  const missingSummary = first.legs.map((leg, index) => {
    const missing = [
      ["from", leg.from],
      ["to", leg.to],
      ["departureDate", leg.departureDate],
      ["arrivalDate", leg.arrivalDate],
      ["departure", leg.departure],
      ["arrival", leg.arrival],
      ["duration", leg.duration],
      ["flightNumber", leg.flightNumber],
      ["airline", leg.airline],
      ["travelClass", leg.travelClass],
      ["fareCategory", leg.fareCategory],
    ].filter(([, value]) => !value).map(([key]) => key);
    return `Trecho ${index + 1}: faltando ${missing.join(", ") || "nenhum campo essencial"}`;
  }).join("\n");

  const second = await runExtraction({
    model: AI_IMAGE_MODEL,
    content: [
      {
        type: "text",
        text: [
          extractionPrompt(directionHint, "imagem"),
          "Esta é uma SEGUNDA CONFERÊNCIA da mesma imagem.",
          "A primeira leitura ficou incompleta. Procure visualmente, com atenção especial, os campos faltantes abaixo:",
          missingSummary,
          "Leia também textos pequenos, cabeçalhos, rodapés e colunas da cotação.",
          "Não altere informações já identificadas a menos que a imagem mostre claramente outro valor.",
          "Retorne todos os campos que conseguir confirmar na imagem.",
        ].join("\n"),
      },
      { type: "image", image },
    ],
  });

  return mergeExtractions(first, second);
}
