import { describe, expect, it, vi } from "vitest";
import {
  PASSHUB_DATA_PATHS, PASSHUB_DATA_RESOURCES,
  passhubDataReadiness, readPasshubData, listPasshubData, detailPasshubData,
  linkPaymentsPasshubData, validatedPasshubDataUrl,
} from "./passhub-data.server";

const env = { PASSHUB_DATA_API_KEY: "test-token-not-real" };
const ok = () => new Response(JSON.stringify({ data: [], meta: { page: 1 } }), {
  status: 200, headers: { "Content-Type": "application/json" },
});

describe("PassHub Data API (read only, no login)", () => {
  it("requires only the new data key, not paid-search credentials", () => {
    expect(passhubDataReadiness({}).ready).toBe(false);
    expect(passhubDataReadiness(env).ready).toBe(true);
    expect(PASSHUB_DATA_RESOURCES).toEqual([
      "air", "bus", "car", "hotel", "insurance", "payment_links", "users",
    ]);
    expect(PASSHUB_DATA_PATHS.bus).toBe("/v1/bus/orders");
  });

  it("uses only the official PassHub API HTTPS host", () => {
    expect(validatedPasshubDataUrl("/v1/orders").href).toBe("https://partner-api.passhub.com.br/v1/orders");
    expect(() => validatedPasshubDataUrl("//evil.com/v1/orders")).toThrow();
    expect(() => validatedPasshubDataUrl("https://evil.com/v1/orders")).toThrow();
  });

  it("does not make any request before the key is configured", async () => {
    const fetcher = vi.fn();
    await expect(readPasshubData("air", {}, fetcher)).rejects.toThrow(/PASSHUB_DATA_API_KEY/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends only X-Api-Key for all 7 resources, with no Authorization", async () => {
    for (const resource of PASSHUB_DATA_RESOURCES) {
      const fetcher = vi.fn().mockResolvedValue(ok());
      await readPasshubData(resource, env, fetcher);
      const [uri, init] = fetcher.mock.calls[0] as [string, RequestInit];
      const url = new URL(uri);
      expect(url.pathname).toBe(PASSHUB_DATA_PATHS[resource]);
      expect(url.searchParams.get("page")).toBe("1");
      expect(url.searchParams.get("pageSize")).toBe("20");
      expect(init.method).toBe("GET");
      expect(init.headers).toEqual({ "X-Api-Key": env.PASSHUB_DATA_API_KEY, Accept: "application/json" });
      expect(init.redirect).toBe("error");
    }
  });

  it("supports up to 100 per page and blocks invalid page numbers", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok());
    await listPasshubData("hotel", 5, 100, env, fetcher);
    const url = new URL(fetcher.mock.calls[0]![0] as string);
    expect(url.pathname).toBe("/v1/hotel/orders");
    expect(url.searchParams.get("page")).toBe("5");
    expect(url.searchParams.get("pageSize")).toBe("100");
    expect(() => listPasshubData("hotel", 1, 101, env, fetcher)).toThrow();
    expect(() => listPasshubData("hotel", 0, 20, env, fetcher)).toThrow();
  });

  it("retrieves original order details by ID and payment attempts", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok());
    await detailPasshubData("insurance", "12345", env, fetcher);
    await detailPasshubData("car", "order-123", env, fetcher);
    await linkPaymentsPasshubData("link-56", env, fetcher);
    expect(new URL(fetcher.mock.calls[0]![0] as string).pathname).toBe("/v1/insurance/orders/12345");
    expect(new URL(fetcher.mock.calls[1]![0] as string).pathname).toBe("/v1/car/orders/order-123");
    expect(new URL(fetcher.mock.calls[2]![0] as string).pathname).toBe("/v1/payment-links/link-56/payments");
    expect(() => detailPasshubData("hotel", "../../auth", env, fetcher)).toThrow(/Identificador/);
  });

  it("reports official API errors without disclosing response bodies", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      token: "must-not-leak", cpf: "must-not-leak",
    }), { status: 401, headers: { "Content-Type": "application/json" } }));
    await expect(readPasshubData("air", env, fetcher)).rejects.toThrow(/inválida ou revogada/);
  });

  it("honors 429 Retry-After as an actionable message", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("", {
      status: 429, headers: { "Retry-After": "22" },
    }));
    await expect(readPasshubData("users", env, fetcher)).rejects.toThrow(/22s/);
  });
});
