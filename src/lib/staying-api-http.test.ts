import { describe, expect, it, vi } from "vitest";
import { stayingGet } from "./staying-api-http.server";
const jobUrl = "/v1/jobs/job_test";
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Retry-After": "1" } });
describe("StayingAPI asynchronous results", () => {
  it("polls the existing job and returns the actual hotel array, not an empty list", async () => {
    const hotels = [{ platform: "booking", name: "Hotel A" }];
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({data:{status:"pending",pollUrl:jobUrl}},202)).mockResolvedValueOnce(response({data:{status:"running",pollUrl:jobUrl}})).mockResolvedValueOnce(response({data:{status:"completed",result:hotels},meta:{partial:false}}));
    const result = await stayingGet("search",new URLSearchParams(),"test-key",{fetcher,sleep:async()=>{}});
    expect(result.data).toEqual(hotels);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(String(fetcher.mock.calls[1]?.[0])).toBe("https://api.stayingapi.com"+jobUrl);
  });
  it("surfaces failed jobs", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({data:{status:"failed",error:{code:"actor_timeout"}}}));
    await expect(stayingGet("search",new URLSearchParams(),"test-key",{fetcher})).rejects.toThrow("actor_timeout");
  });
  it("never forwards credentials to an external polling host", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({data:{status:"pending",pollUrl:"https://example.org/v1/jobs/job_test"}},202));
    await expect(stayingGet("search",new URLSearchParams(),"test-key",{fetcher})).rejects.toThrow("endereço de consulta inválido");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("preserves immediate empty results and reports permission errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({data:[]})).mockResolvedValueOnce(response({error:{code:"email_unverified"}},403));
    expect((await stayingGet("search",new URLSearchParams(),"test-key",{fetcher})).data).toEqual([]);
    await expect(stayingGet("search",new URLSearchParams(),"test-key",{fetcher})).rejects.toThrow("email_unverified");
  });
});
