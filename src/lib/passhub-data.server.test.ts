import { describe, expect, it, vi } from "vitest";
import { PASSHUB_DATA_RESOURCES, passhubDataReadiness, readPasshubData, validatedPasshubDataUrl } from "./passhub-data.server";

const configured = {
  PASSHUB_DATA_API_KEY: "fake-secret-for-tests",
  PASSHUB_DATA_API_BASE_URL: "https://api.passhub.com.br",
  PASSHUB_DATA_API_AUTH_HEADER: "Authorization",
  PASSHUB_DATA_API_AUTH_PREFIX: "Bearer ",
  PASSHUB_DATA_RESERVATIONS_PATH: "/v1/reservas",
};

describe("isolated PassHub read-only data API", () => {
  it("does not claim readiness based solely on a key", () => {
    expect(passhubDataReadiness({ PASSHUB_DATA_API_KEY: "placeholder" }).ready).toBe(false);
    expect(passhubDataReadiness(configured).ready).toBe(true);
    expect(passhubDataReadiness(configured).resources.issuances).toBe(false);
    expect(PASSHUB_DATA_RESOURCES).toEqual(["reservations", "issuances", "payment_links", "users"]);
  });

  it("restricts the endpoint to HTTPS PassHub hosts", () => {
    expect(validatedPasshubDataUrl(configured.PASSHUB_DATA_API_BASE_URL, "/v1/reservas").href).toBe("https://api.passhub.com.br/v1/reservas");
    for (const url of ["http://api.passhub.com.br", "https://passhub.com.br.evil.test", "https://localhost:8080", "https://127.0.0.1", "https://user@api.passhub.com.br"]) {
      expect(() => validatedPasshubDataUrl(url, "/reservas")).toThrow();
    }
    for (const path of ["//evil.test/path", "/../users", "/data?token=secret", "/a#hash"]) {
      expect(() => validatedPasshubDataUrl(configured.PASSHUB_DATA_API_BASE_URL, path)).toThrow();
    }
  });

  it("does not contact any host before the guide and base settings are filled", async () => {
    const requester = vi.fn();
    await expect(readPasshubData("reservations", { PASSHUB_DATA_API_KEY: "secret" }, requester)).rejects.toThrow(/incompleta/);
    expect(requester).not.toHaveBeenCalled();
  });

  it("uses a GET, never exposes or logs the token, and returns JSON internally", async () => {
    const requester = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(readPasshubData("reservations", configured, requester)).resolves.toEqual({ data: [] });
    const [url, request] = requester.mock.calls[0];
    expect(url).toBe("https://api.passhub.com.br/v1/reservas");
    expect(request.method).toBe("GET");
    expect(request.redirect).toBe("error");
    expect(request.headers.Authorization).toBe("Bearer fake-secret-for-tests");
  });

  it("never returns provider error bodies containing sensitive data", async () => {
    const requester = vi.fn().mockResolvedValue(new Response('{"token":"must-never-show","cpf":"xxx"}', { status: 401 }));
    await expect(readPasshubData("reservations", configured, requester)).rejects.toThrow("Chave rejeitada ou sem permissão.");
  });
});
