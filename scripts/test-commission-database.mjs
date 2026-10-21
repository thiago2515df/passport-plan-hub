// Run against an isolated, in-memory PostgreSQL. Install @electric-sql/pglite
// with --no-save, or provide PGLITE_MODULE pointing to its ESM entry point.
// No credentials, production database, or paid supplier requests are used.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
const admin = "10000000-0000-4000-8000-000000000001";
const seller = "10000000-0000-4000-8000-000000000002";
const other = "10000000-0000-4000-8000-000000000003";
let checks = 0;
const check = (actual, expected) => {
  assert.deepEqual(actual, expected);
  checks++;
};
const sql = (text) => db.exec(text);
const one = async (query, params = []) => (await db.query(query, params)).rows[0];
const as = async (role, id = "") =>
  sql(`RESET ROLE; SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub','${id}',false);`);
const denied = async (query, pattern) => {
  await assert.rejects(() => sql(query), pattern);
  checks++;
};
const payload = (version, mode = "none", cost = 1000, extras = []) =>
  Buffer.from(
    JSON.stringify({
      s: {
        destino: mode === "bus" ? "Caldas Novas" : "Rio de Janeiro",
        checkin: "2027-01-10",
        checkout: "2027-01-12",
        hospedes: "1 quarto · 2 hóspedes",
        adults: 2,
        childAges: [5, 6],
        rav: 0,
        telefone: "private",
        commissionUpdatedAt: version,
        transport: {
          mode,
          price: mode === "air" ? 500 : 0,
          outbound: { company: "Test", departure: "09:00", arrival: "11:00" },
          inbound: { company: "", departure: "", arrival: "" },
        },
        extras,
      },
      hotels: [
        {
          name: "Hotel A",
          address: "",
          stars: 4,
          image: "",
          total: cost,
          nightly: cost / 2,
          provider: "airbnb",
          providerListingId: "123456789",
          publicDetails: { description: "Saved details" },
        },
        { name: "Hotel B", address: "", stars: 4, image: "", total: cost + 500, nightly: 0 },
      ],
    }),
  ).toString("base64");
const publicView = async (code) => {
  const row = await one("SELECT public.public_proposal($1) AS payload", [code]);
  return row.payload ? JSON.parse(Buffer.from(row.payload, "base64").toString()) : null;
};
try {
  await sql(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, active boolean DEFAULT true);
    CREATE TABLE public.user_roles(user_id uuid REFERENCES public.profiles(id),role text);
    CREATE FUNCTION public.has_role(_user_id uuid,_role text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
    CREATE FUNCTION public.seller_can(_permission text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
    CREATE TABLE public.proposals(code text PRIMARY KEY,payload text NOT NULL,owner_id uuid REFERENCES public.profiles(id),status text NOT NULL DEFAULT 'created');
    GRANT SELECT,INSERT,UPDATE ON public.proposals TO authenticated;
    ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
    CREATE POLICY proposal_owner ON public.proposals TO authenticated USING(owner_id=auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK(owner_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
    INSERT INTO public.profiles(id) VALUES('${admin}'),('${seller}'),('${other}');
    INSERT INTO public.user_roles VALUES('${admin}','admin'),('${seller}','seller'),('${other}','seller');
  `);
  for (const name of [
    "0005_seller_commissions_private_package_prices",
    "0006_proposal_package_acceptance",
    "0007_preserve_public_airbnb_gallery",
  ]) {
    await sql(
      await readFile(new URL(`../drizzle/migrations/${name}.sql`, import.meta.url), "utf8"),
    );
  }
  // A seller-created legacy rate must never be mistaken for admin confirmation.
  await as("authenticated", seller);
  await sql(
    `INSERT INTO public.seller_commissions(user_id,air_kind,air_value,bus_value) VALUES('${seller}','fixed',20,20)`,
  );
  await sql(
    `INSERT INTO public.proposals(code,owner_id,payload) VALUES('pending1','${seller}','${payload(null)}')`,
  );
  await as("postgres");
  await sql(
    await readFile(
      new URL("../drizzle/migrations/0008_admin_confirmed_seller_commissions.sql", import.meta.url),
      "utf8",
    ),
  );
  let row = await one(`SELECT * FROM public.seller_commissions WHERE user_id='${seller}'`);
  check(
    [row.air_kind, Number(row.air_value), Number(row.bus_value), row.configured_at],
    ["fixed", 20, 20, null],
  );
  check(await publicView("pending1"), null);
  await as("authenticated", seller);
  check(
    (
      await db.query(
        `UPDATE public.seller_commissions SET air_value=0,configured_at=now() WHERE user_id='${seller}' RETURNING user_id`,
      )
    ).rows,
    [],
  );
  await denied(
    `INSERT INTO public.seller_commissions(user_id) VALUES('${other}')`,
    /row-level security|Somente o administrador/,
  );
  await denied(
    `INSERT INTO public.proposals(code,owner_id,payload) VALUES('blocked1','${seller}','${payload(null)}')`,
    /administrador precisa/,
  );
  await as("authenticated", admin);
  await sql(
    `UPDATE public.seller_commissions SET hotel_kind='percent',hotel_value=20,air_kind='percent',air_value=20,bus_kind='fixed',bus_value=50 WHERE user_id='${seller}'`,
  );
  row = await one(`SELECT * FROM public.seller_commissions WHERE user_id='${seller}'`);
  const version = (
    await one(
      `SELECT configured_at::text AS version FROM public.seller_commissions WHERE user_id='${seller}'`,
    )
  ).version;
  check(row.configured_by, admin);
  check(!!row.configured_at, true);
  await as("authenticated", other);
  check((await db.query("SELECT * FROM public.seller_commissions")).rows, []);
  await as("authenticated", seller);
  check((await db.query("SELECT * FROM public.seller_commissions")).rows.length, 1);
  await denied(
    `INSERT INTO public.proposals(code,owner_id,payload) VALUES('forged12','${other}','${payload(version)}')`,
    /Sem permissão/,
  );
  await denied(
    `INSERT INTO public.proposals(code,owner_id,payload) VALUES('stale123','${seller}','${payload("2000-01-01T00:00:00Z")}')`,
    /comissão foi atualizada/,
  );
  for (const [code, mode] of [
    ["hotel123", "none"],
    ["air12345", "air"],
    ["bus12345", "bus"],
  ]) {
    await sql(
      `INSERT INTO public.proposals(code,owner_id,payload) VALUES('${code}','${seller}','${payload(version, mode)}')`,
    );
  }
  await sql(
    `INSERT INTO public.proposals(code,owner_id,payload) VALUES('extra123','${seller}','${payload(version, "none", 1000, [{ name: "Passeio", cost: 80 }])}')`,
  );
  await as("anon");
  check((await publicView("pending1")).hotels[0].total, 1200);
  const withExtras = await publicView("extra123");
  check(withExtras.hotels[0].total, 1296);
  check(withExtras.s.extras, [{ name: "Passeio", cost: 0 }]);
  const hotel = await publicView("hotel123");
  check(
    hotel.hotels.map((h) => h.total),
    [1200, 1800],
  );
  check(
    (await publicView("air12345")).hotels.map((h) => h.total),
    [1800, 2400],
  );
  check(
    (await publicView("bus12345")).hotels.map((h) => h.total),
    [1380, 1880],
  );
  check(hotel.hotels[0].providerListingId, "123456789");
  check(hotel.hotels[0].publicDetails.description, "Saved details");
  check(hotel.hotels[0].nightly, 0);
  check("price" in hotel.s.transport, false);
  check(
    "telefone" in hotel.s || "commissionUpdatedAt" in hotel.s || "commission" in hotel.hotels[0],
    false,
  );
  check(await publicView("bad/code"), null);
  await denied("SELECT * FROM public.seller_commissions", /permission denied/);
  await denied(`SELECT public.accept_proposal_package('hotel123',0,1000)`, /preço foi atualizado/);
  await sql(`SELECT public.accept_proposal_package('hotel123',0,1200)`);
  await as("authenticated", seller);
  let accepted = await one(`SELECT * FROM public.proposal_acceptances WHERE code='hotel123'`);
  check(
    [
      Number(accepted.commission),
      Number(accepted.total),
      accepted.commission_kind,
      Number(accepted.commission_value),
    ],
    [200, 1200, "percent", 20],
  );
  await denied(
    `UPDATE public.proposals SET payload='${payload(version, "none", 2000)}' WHERE code='hotel123'`,
    /já foi aceito/,
  );
  await as("authenticated", admin);
  await sql(
    `UPDATE public.seller_commissions SET hotel_value=30,air_value=30,bus_value=70 WHERE user_id='${seller}'`,
  );
  await as("anon");
  check(
    (await publicView("hotel123")).hotels.map((h) => h.total),
    [1200, 1800],
  );
  check(
    (await publicView("air12345")).hotels.map((h) => h.total),
    [1950, 2600],
  );
  check(
    (await publicView("bus12345")).hotels.map((h) => h.total),
    [1400, 1900],
  );
  await sql(`SELECT public.accept_proposal_package('hotel123',0,1200)`);
  await denied(`SELECT public.accept_proposal_package('hotel123',1,1800)`, /já possui/);
  await sql(`SELECT public.accept_proposal_package('air12345',1,2600)`);
  await as("authenticated", seller);
  accepted = await one(`SELECT * FROM public.proposal_acceptances WHERE code='air12345'`);
  check(
    [Number(accepted.commission), Number(accepted.total), Number(accepted.commission_value)],
    [600, 2600, 30],
  );
  await as("authenticated", admin);
  // An explicit zero is a valid administrator decision, unlike a missing rule.
  await sql(
    `INSERT INTO public.seller_commissions(user_id,hotel_kind,hotel_value,air_value,bus_value) VALUES('${other}','percent',0,0,0)`,
  );
  const zero = await one(
    `SELECT configured_at::text AS version FROM public.seller_commissions WHERE user_id='${other}'`,
  );
  await as("authenticated", other);
  await sql(
    `INSERT INTO public.proposals(code,owner_id,payload) VALUES('zerorate','${other}','${payload(zero.version)}')`,
  );
  await as("anon");
  check((await publicView("zerorate")).hotels[0].total, 1000);
  await as("postgres");
  await sql(`DELETE FROM public.seller_commissions WHERE user_id='${seller}'`);
  await as("anon");
  check((await publicView("hotel123")).hotels[0].total, 1200);
  check((await publicView("air12345")).hotels[1].total, 2600);
  check(await publicView("bus12345"), null);
  console.log(`PostgreSQL commission checks passed: ${checks}`);
} finally {
  await db.close();
}
