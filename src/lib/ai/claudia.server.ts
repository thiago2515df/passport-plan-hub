import { z } from "zod";

const CLAUDIA_BASE_URL = "https://api.llmsrelay.com";
const CLAUDIA_MODEL = process.env["LLMSRELAY_MODEL"]?.trim()
  || process.env["CLAUDIA_MODEL"]?.trim()
  || "claude-opus-5-5";

type ClaudiaContent =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: string; data: string };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function apiKey() {
  const key = process.env["LLMSRELAY_API_KEY"]?.trim();
  if (!key) throw new Error("A Claudia ainda não está configurada. Cadastre LLMSRELAY_API_KEY no servidor.");
  return key;
}

function userError(status: number, detail: string) {
  if (status === 401) return new Error("A chave da Claudia não foi aceita pela LLMsRelay.");
  if (status === 402) return new Error("A conta/chave da Claudia está sem saldo suficiente ou sem limite disponível.");
  if (status === 403) return new Error("A chave da Claudia não tem acesso ao modelo configurado. Confira o grupo da chave e o LLMSRELAY_MODEL.");
  if (status === 429) return new Error("A Claudia atingiu o limite de uso agora. Tente novamente em instantes.");
  if (status >= 500) return new Error("A LLMsRelay está indisponível no momento. Tente novamente em instantes.");
  return new Error(detail || `A Claudia não conseguiu processar a solicitação (HTTP ${status}).`);
}

function extractJson(text: string): unknown {
  const clean = text.trim()
    .replace(/^\`\`\`(?:json)?\s*/i, "")
    .replace(/\s*\`\`\`$/i, "");
  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("A Claudia respondeu sem um JSON válido.");
  return JSON.parse(clean.slice(first, last + 1));
}

export function isClaudiaConfigured() {
  return Boolean(process.env["LLMSRELAY_API_KEY"]?.trim());
}

export async function claudiaJson<T>({
  system,
  prompt,
  content = [],
  schema,
  maxTokens = 3000,
}: {
  system: string;
  prompt: string;
  content?: ClaudiaContent[];
  schema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<T> {
  const key = apiKey();

  const parts: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const item of content) {
    if (item.type === "text") {
      parts.push({ type: "text", text: item.text });
    } else {
      parts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: item.mediaType,
          data: item.data,
        },
      });
    }
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) await sleep(Math.min(4_000, 600 * 2 ** (attempt - 2)));

    try {
      const response = await fetch(`${CLAUDIA_BASE_URL}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CLAUDIA_MODEL,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: parts }],
        }),
        signal: AbortSignal.timeout(90_000),
      });

      const raw = await response.text();
      if (!response.ok) {
        const err = userError(response.status, raw.slice(0, 600));
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < 3) {
          lastError = err;
          continue;
        }
        throw err;
      }

      const json = JSON.parse(raw) as {
        content?: Array<{ type?: string; text?: string }>;
      };
      const text = (json.content ?? [])
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text ?? "")
        .join("\n")
        .trim();

      if (!text) throw new Error("A Claudia não retornou conteúdo.");
      return schema.parse(extractJson(text));
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= 3 || !/429|tempor|timeout|fetch failed|indisponível/i.test(message)) throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("A Claudia não conseguiu responder.");
}
