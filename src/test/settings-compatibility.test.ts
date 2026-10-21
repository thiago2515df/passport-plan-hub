import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (data: unknown) => data;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: typeof validate) => {
        validate = fn;
        return builder;
      },
      handler: (fn: (args: unknown) => unknown) => (args: { data: unknown; context: unknown }) =>
        fn({ ...args, data: validate(args.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/proposal-lifecycle.server", () => ({
  maintainProposalLifecycle: vi.fn(async () => {}),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { auth: { admin: { createUser: vi.fn(), deleteUser: vi.fn() } } },
}));
import { getSettings, listMyProposals, createSeller } from "@/lib/settings.functions";
import { getSellerCommissions, saveSellerCommissions } from "@/lib/commissions.functions";
import { readCommissionSettings } from "@/lib/commissions.server";
import {
  requireConfiguredCommissions,
  COMMISSION_MIGRATION_REQUIRED,
} from "@/lib/commission-rules";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encodeProposal } from "@/lib/hotels";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const adminId = "10000000-0000-4000-8000-000000000001";
const sellerId = "10000000-0000-4000-8000-000000000002";
const rates = {
  hotel: { kind: "percent", value: 20 },
  air: { kind: "fixed", value: 20 },
  bus: { kind: "percent", value: 15 },
};
const legacy = {
  user_id: sellerId,
  air_kind: "fixed",
  air_value: 20,
  bus_kind: "percent",
  bus_value: 15,
};
const modern = {
  ...legacy,
  hotel_kind: "percent",
  hotel_value: 20,
  configured_at: "2026-10-21T18:00:00.123456+00:00",
};
const people = [
  { id: adminId, name: "Thiago", email: "admin@example.test", phone: "", active: true },
  { id: sellerId, name: "Aline", email: "aline@example.test", phone: "", active: true },
];
const payload = encodeProposal({
  s: {
    destino: "Rio",
    checkin: "2027-01-10",
    checkout: "2027-01-12",
    hospedes: "2 hóspedes",
    rav: 0,
  },
  hotels: [{ name: "Hotel", total: 1000, nightly: 500, stars: 3, image: "", address: "" }],
});
function setup({
  schema = "legacy",
  rows,
  failTable = "",
}: { schema?: "legacy" | "modern"; rows?: unknown[]; failTable?: string } = {}) {
  const data: Record<string, unknown[]> = {
    profiles: people,
    seller_permissions: [
      {
        user_id: sellerId,
        search_hotels: true,
        search_flights: true,
        create_proposals: true,
        manage_transport: true,
      },
    ],
    system_settings: [{ id: 1, agency_name: "Excursão Brasília", whatsapp: "5561992267062" }],
    access_activity: [],
    proposals: [
      {
        code: "test1234",
        owner_id: sellerId,
        payload,
        status: "created",
        created_at: "2026-10-21T18:00:00Z",
        updated_at: "2026-10-21T18:00:00Z",
        sent_at: null,
      },
    ],
    seller_commissions: rows ?? [schema === "legacy" ? legacy : modern],
  };
  const calls: { table: string; columns: string }[] = [];
  const from = vi.fn((table: string) => {
    let columns = "*";
    const filters: [string, unknown][] = [];
    const result = () => {
      if (failTable === table)
        return { data: null, error: { code: "08006", message: "Connection unavailable" } };
      if (table === "seller_commissions" && schema === "legacy" && columns !== "*")
        return {
          data: null,
          error: { code: "42703", message: "column seller_commissions.hotel_kind does not exist" },
        };
      const rows = (data[table] ?? []).filter((value) =>
        filters.every(([key, expected]) => (value as Record<string, unknown>)[key] === expected),
      );
      return { data: rows, error: null };
    };
    const chain = {
      select: vi.fn((value: string) => {
        columns = value;
        calls.push({ table, columns });
        return chain;
      }),
      eq: vi.fn((key: string, value: unknown) => {
        filters.push([key, value]);
        return chain;
      }),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle: async () => {
        const response = result();
        return { ...response, data: response.data?.[0] ?? null };
      },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject),
    };
    return chain;
  });
  const client = {
    from,
    rpc: vi.fn(async (name: string) => ({
      data: name === "my_proposal_acceptances" ? [] : true,
      error: null,
    })),
  } as unknown as SupabaseClient<Database>;
  return { client, context: { userId: adminId, supabase: client }, calls };
}
const invoke = (fn: unknown, data: unknown, context: unknown) =>
  (fn as (args: unknown) => Promise<unknown>)({ data, context });
beforeEach(() => vi.clearAllMocks());
describe("settings and proposal reads during commission schema upgrades", () => {
  it("preserves the seller roster and existing values when the hotel columns do not exist", async () => {
    const { context } = setup();
    const result = (await invoke(getSettings, undefined, context)) as Awaited<
      ReturnType<typeof getSettings>
    >;
    expect(result.people.map((person) => person.name)).toEqual(["Thiago", "Aline"]);
    expect(result.rights[0]?.user_id).toBe(sellerId);
    expect(result.commissionIssue).toBe("migration_required");
    expect(result.commissions).toEqual([{ user_id: sellerId, configured_at: null }]);
    const settings = await invoke(getSellerCommissions, { userId: sellerId }, context);
    expect(settings).toMatchObject({
      air: { kind: "fixed", value: 20 },
      bus: { kind: "percent", value: 15 },
      configured: false,
      issue: "migration_required",
    });
  });
  it("loads the board without the raw hotel.kind / NaN exception from legacy rows", async () => {
    const { context } = setup();
    const result = (await invoke(listMyProposals, undefined, context)) as Awaited<
      ReturnType<typeof listMyProposals>
    >;
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ code: "test1234", seller_name: "Aline", commissions: null });
  });
  it("detects an old schema even when the commission table has no records", async () => {
    const { client } = setup({ rows: [] });
    const settings = await readCommissionSettings(client, sellerId);
    expect(settings.issue).toBe("migration_required");
    expect(() => requireConfiguredCommissions(settings)).toThrow(COMMISSION_MIGRATION_REQUIRED);
  });
  it("keeps sellers and proposals visible when the commission request fails", async () => {
    const { context } = setup({ failTable: "seller_commissions" });
    const settings = (await invoke(getSettings, undefined, context)) as Awaited<
      ReturnType<typeof getSettings>
    >;
    expect(settings.people).toHaveLength(2);
    expect(settings.commissionIssue).toBe("unavailable");
    const board = (await invoke(listMyProposals, undefined, context)) as Awaited<
      ReturnType<typeof listMyProposals>
    >;
    expect(board[0]?.commissions).toBe(null);
  });
  it("does not hide the roster for unrelated activities or proposal history errors", async () => {
    for (const failTable of ["access_activity", "proposals", "system_settings"]) {
      const { context } = setup({ schema: "modern", failTable });
      const settings = (await invoke(getSettings, undefined, context)) as Awaited<
        ReturnType<typeof getSettings>
      >;
      expect(settings.people).toHaveLength(2);
      expect(settings.warnings).toHaveLength(1);
    }
  });
  it("keeps a real seller query failure distinct from an empty roster", async () => {
    const { context } = setup({ failTable: "profiles" });
    await expect(invoke(getSettings, undefined, context)).rejects.toThrow(
      "Não foi possível consultar os vendedores",
    );
  });
  it("blocks saving and provisioning before an unavailable migration can cause partial account changes", async () => {
    const { context } = setup();
    await expect(
      invoke(saveSellerCommissions, { ...rates, userId: sellerId }, context),
    ).rejects.toThrow(COMMISSION_MIGRATION_REQUIRED);
    await expect(
      invoke(
        createSeller,
        {
          name: "Nova vendedora",
          email: "nova@example.test",
          phone: "",
          password: "",
          redirectTo: "https://propostabsb.excursaobrasilia.com.br/reset-password",
          permissions: {
            search_hotels: true,
            search_flights: true,
            create_proposals: true,
            manage_transport: true,
          },
          commissions: rates,
        },
        context,
      ),
    ).rejects.toThrow(COMMISSION_MIGRATION_REQUIRED);
    expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(supabaseAdmin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
  it("recognizes a confirmed current schema after the database upgrade", async () => {
    const { client, context } = setup({ schema: "modern" });
    const settings = await readCommissionSettings(client, sellerId);
    expect(requireConfiguredCommissions(settings).hotel).toEqual({ kind: "percent", value: 20 });
    const result = (await invoke(getSettings, undefined, context)) as Awaited<
      ReturnType<typeof getSettings>
    >;
    expect(result.commissionIssue).toBe(null);
    expect(result.commissions[0]?.configured_at).toBe(modern.configured_at);
  });
});
