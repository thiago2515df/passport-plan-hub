import { createOpenAI } from "@ai-sdk/openai";
import { Output, generateText } from "ai";
import { z } from "zod";

const AI_MODEL = process.env["FREELLMAPI_MODEL"]?.trim() || "auto";
const AI_IMAGE_MODEL = process.env["FREELLMAPI_IMAGE_MODEL"]?.trim() || "gemini-3.6-flash";
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
    `Você é um especialista em leitura de passagens aéreas e rodoviárias. Analise ${source === "imagem" ? "a imagem inteira" : "o texto inteiro"} e extraia SOMENTE informações realmente visíveis.`,
    directionInstruction,
    "REGRA PRINCIPAL: nunca invente, complete, suponha ou corrija informações que não estejam claramente presentes. Se não conseguir confirmar um campo, retorne null.",
    "",
    "COMPANHIAS AÉREAS — identifique usando, nesta ordem: 1) prefixo/número do voo, 2) nome escrito, 3) logotipo visível.",
    "Mapeamentos obrigatórios por prefixo IATA: LA ou JJ = LATAM Airlines; G3 = GOL Linhas Aéreas; AD = Azul Linhas Aéreas; 2Z = Voepass; TP = TAP Air Portugal; AR = Aerolíneas Argentinas; AV = Avianca; CM = Copa Airlines; AA = American Airlines; DL = Delta Air Lines; UA = United Airlines; AC = Air Canada; AF = Air France; KL = KLM; IB = Iberia; UX = Air Europa; EK = Emirates; QR = Qatar Airways; AZ = ITA Airways; LH = Lufthansa; LX = SWISS.",
    "Exemplos: LA 3770 ou LA-3770 = LATAM Airlines; G3 1622 = GOL Linhas Aéreas; AD4107 = Azul Linhas Aéreas.",
    "Se aparecer nome genérico como 'operadora', 'companhia aérea' ou 'LIGHT - OPERADORA', mas o prefixo do voo estiver claro, use a companhia do prefixo.",
    "",
    "ORIGEM E DESTINO — procure primeiro códigos IATA de 3 letras próximos à cidade/horário. Exemplos: Brasília (BSB), BSB Brasília, Porto Alegre (POA), REC Recife, GIG Rio de Janeiro.",
    "Se a sigla estiver visível, use a sigla em from/to. Se só a cidade estiver visível, não invente a sigla.",
    "",
    "DATAS E HORÁRIOS — datas em YYYY-MM-DD e horários em HH:MM. Não confunda duração com horário. Exemplo: 02h35 é duração; 20:40 é saída; 23:15 é chegada.",
    "",
    "DURAÇÃO E ESCALAS — use 'Direto' apenas quando 'Direto' ou 'Voo direto' estiver visível. Preserve conexão/escala se estiver escrita. Não invente escalas.",
    "",
    "VALORES — pode haver vários números no mesmo print. Prioridade: 1) Total/Valor total/Total BRL; 2) preço principal destacado; 3) Por pessoa; 4) taxas.",
    "Nunca use BLOQUEIO, tarifa de bloqueio, comissão ou taxas como totalPrice, a menos que o próprio print diga explicitamente que esse é o total final.",
    "Se houver 'Por pessoa BRL 634,15' e 'Total BRL 1.268,31', retorne totalPrice=1268.31, perPersonPrice=634.15, currency='BRL'.",
    "Converta valores brasileiros: R$ 3.836,52 = 3836.52.",
    "",
    "CLASSE — preserve exatamente o tipo visível quando possível: Econômica, Convencional, Executivo, Leito etc. Não confunda classe com nome de tarifa.",
    "",
    "BAGAGEM — true somente se claramente incluída; false somente se claramente não incluída; null se não der para saber. Não conclua inclusão apenas pelo desenho de uma mala.",
    "",
    "IDA E VOLTA — se houver seções IDA e VOLTA, retorne dois objetos em legs. out=ida, back=volta. Nunca misture os dados da ida com a volta.",
    "",
    "MODALIDADE — se o conteúdo for rodoviário (rodoviária, convencional/leito, empresa de ônibus, rota terrestre), não invente número de voo ou aeroporto.",
    "",
    "LEITURA VISUAL — leia cabeçalhos, rodapés, caixas laterais, textos pequenos, preço destacado, número abaixo do logo e informações expandidas.",
    "",
    "VALIDAÇÃO FINAL — antes de responder confira: companhia, número do voo, origem, destino, datas, horários, duração, escalas, classe, bagagens e preços. Se algo não estiver claramente legível, deixe null.",
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
  return runExtraction({
    model: AI_IMAGE_MODEL,
    content: [
      {
        type: "text",
        text: [
          extractionPrompt(directionHint, "imagem"),
          "Leia apenas o que estiver claramente visível na imagem.",
          "Não deduza, não complete e não corrija dados por conta própria.",
          "Se um horário, aeroporto, duração, preço ou outra informação não estiver legível, retorne null nesse campo.",
          "Revise visualmente cada campo antes de responder: companhia, número do voo, origem, destino, datas, horários, duração, escalas, classe, bagagem e valores.",
        ].join("\n"),
      },
      { type: "image", image: new URL(imageDataUrl) },
    ],
  });
}