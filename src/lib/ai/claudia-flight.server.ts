import { z } from "zod";
import { claudiaJson } from "./claudia.server";

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

export type ClaudiaFlightExtraction = z.infer<typeof extractionSchema>;

function prompt(directionHint: "out" | "back" | "auto", source: "imagem" | "texto") {
  const directionInstruction = directionHint === "out"
    ? "Este conteúdo foi enviado no campo de IDA. Se houver apenas um trecho, classifique-o como out."
    : directionHint === "back"
      ? "Este conteúdo foi enviado no campo de VOLTA. Se houver apenas um trecho, classifique-o como back."
      : "Identifique ida e volta pelo conteúdo disponível.";

  return [
    `Leia este ${source} como uma cotação ou passagem aérea e extraia apenas informações realmente visíveis.`,
    directionInstruction,
    "Não invente dados.",
    "Identifique a companhia também pelo prefixo do voo: LA/JJ=LATAM Airlines, G3=GOL Linhas Aéreas, AD=Azul Linhas Aéreas, 2Z=Voepass, TP=TAP Air Portugal, AR=Aerolíneas Argentinas, AV=Avianca, CM=Copa Airlines.",
    "Se houver conflito entre um rótulo genérico da tela e o prefixo IATA do voo, priorize o prefixo IATA.",
    "Datas em YYYY-MM-DD e horários em HH:MM.",
    "Bagagem: true apenas se claramente incluída, false apenas se claramente não incluída, null se não der para saber.",
    "Se houver ida e volta, devolva os dois trechos em legs.",
    "Se houver valor total explícito, use totalPrice. Não calcule um total que não esteja escrito.",
    "Deixe null para campos ausentes ou duvidosos.",
    "Responda SOMENTE com JSON válido exatamente neste formato:",
    JSON.stringify({
      legs: [{
        direction: "out",
        airline: "LATAM Airlines",
        flightNumber: "LA 4724",
        from: "BSB",
        to: "REC",
        departureDate: "2027-04-01",
        arrivalDate: "2027-04-01",
        departure: "14:35",
        arrival: "17:10",
        duration: "02:35",
        stops: "Direto",
        travelClass: "Econômica",
        fareCategory: null,
        baggage: { personal: null, carryOn: null, checked: null }
      }],
      totalPrice: null,
      perPersonPrice: null,
      currency: "BRL",
      confidence: 0.9,
      notes: []
    }),
  ].join("\n");
}

export async function claudiaExtractFlightFromText({
  text,
  directionHint,
}: {
  text: string;
  directionHint: "out" | "back" | "auto";
}): Promise<ClaudiaFlightExtraction> {
  return claudiaJson({
    system: "Você é Claudia, assistente de viagens da Excursão Brasília. Sua tarefa é ler cotações aéreas com precisão e devolver somente JSON válido.",
    prompt: prompt(directionHint, "texto"),
    content: [{ type: "text", text }],
    schema: extractionSchema,
  });
}

export async function claudiaExtractFlightFromImage({
  imageDataUrl,
  directionHint,
}: {
  imageDataUrl: string;
  directionHint: "out" | "back" | "auto";
}): Promise<ClaudiaFlightExtraction> {
  const match = imageDataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) throw new Error("Envie uma imagem PNG, JPG ou WebP.");
  const mediaType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const data = match[2];

  return claudiaJson({
    system: "Você é Claudia, assistente de viagens da Excursão Brasília. Sua tarefa é ler prints e cotações aéreas com precisão e devolver somente JSON válido.",
    prompt: prompt(directionHint, "imagem"),
    content: [{ type: "image", mediaType, data }],
    schema: extractionSchema,
  });
}
