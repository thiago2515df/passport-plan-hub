import { createOpenAI } from "@ai-sdk/openai";
import { Output, generateText } from "ai";
import { z } from "zod";

const AI_MODEL = process.env["FREELLMAPI_MODEL"]?.trim() || "gemini-3.8-flash";
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
  if (status === 429) return new Error("O provedor selecionado pelo FreeLLMAPI atingiu o limite agora. O roteador tentará os provedores disponíveis.");
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
}: {
  content: Array<{ type: "text"; text: string } | { type: "image"; image: URL }>;
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
        model: provider.chat(AI_MODEL),
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
  return runExtraction({
    content: [
      { type: "text", text: extractionPrompt(directionHint, "imagem") },
      { type: "image", image: new URL(imageDataUrl) },
    ],
  });
}
