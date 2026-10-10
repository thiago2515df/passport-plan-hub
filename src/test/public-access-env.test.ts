import { describe, expect, it } from "vitest";
import { publicAccessDefines } from "../../build/public-access-env";

describe("Public access build configuration", () => {
  it("provides public connection settings when deployment environment is missing", () => {
    const defines = publicAccessDefines({});
    expect(JSON.parse(defines["import.meta.env.VITE_SUPABASE_URL"])).toBe("https://tpjihnmjdapzprwyefot.supabase.co");
    expect(JSON.parse(defines["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"])).toBe("sb_publishable_IsajeINU7XRjCdLwtONZwA_aPInwiAI");
  });

  it("preserves preview overrides instead of connecting a draft to live", () => {
    const defines = publicAccessDefines({ VITE_SUPABASE_URL: "https://preview.example.test", VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_preview" });
    expect(JSON.parse(defines["import.meta.env.VITE_SUPABASE_URL"])).toBe("https://preview.example.test");
    expect(JSON.parse(defines["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"])).toBe("sb_publishable_preview");
  });

  it("treats empty deployment values as missing", () => {
    expect(publicAccessDefines({ VITE_SUPABASE_URL: " ", VITE_SUPABASE_PUBLISHABLE_KEY: "" })).toEqual(publicAccessDefines({}));
  });

  it("never injects server credentials or runtime-only addresses", () => {
    const defines = publicAccessDefines({ SUPABASE_URL: "http://private-runtime.test", SUPABASE_SERVICE_ROLE_KEY: "private-test-credential" });
    expect(Object.keys(defines)).toEqual(["import.meta.env.VITE_SUPABASE_URL", "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"]);
    expect(JSON.stringify(defines)).not.toContain("private-runtime");
    expect(JSON.stringify(defines)).not.toContain("private-test-credential");
  });
});