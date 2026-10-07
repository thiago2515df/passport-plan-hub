import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plane, Bus, Shield, Building2, Users, MapPin, Calendar, Search as SearchIcon, Filter, Star, CreditCard, Trash2, Link2, Check, ChevronDown } from "lucide-react";
import { HOTELS, COMMISSION, brl, nightsBetween, encodeProposal, type Search } from "@/lib/hotels";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hospedagem — PassHub Propostas" },
      { name: "description", content: "Busque hotéis, selecione opções e gere um link de proposta para o cliente." },
      { property: "og:title", content: "Hospedagem — PassHub Propostas" },
      { property: "og:description", content: "Busque hotéis e gere propostas em segundos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const MAX = 3;
const nav = [
  ["COTAÇÕES", [[Plane, "Aéreo"], [Bus, "Rodoviário"], [Shield, "Seguros"], [Building2, "Hospedagem"]]],
] as const;

function Index() {
  const [s, setS] = useState<Search>({ destino: "Caldas Novas (e arredores), Brasil", checkin: "2026-10-16", checkout: "2026-10-18", hospedes: "1 quarto · 3 hóspedes", rav: 0 });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [sel, setSel] = useState<string[]>([]);
  const [link, setLink] = useState("");
  const nights = nightsBetween(s.checkin, s.checkout);
  const price = (n: number) => n * (1 + s.rav / 100);

  const list = useMemo(() => HOTELS.filter(h => h.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === "asc" ? a.nightly - b.nightly : b.nightly - a.nightly), [q, sort]);

  const toggle = (id: string) => { setLink(""); setSel(p => p.includes(id) ? p.filter(x => x !== id) : p.length < MAX ? [...p, id] : p); };
  const gerar = () => {
    const url = `${window.location.origin}/proposta?t=${encodeURIComponent(encodeProposal({ s, ids: sel }))}`;
    setLink(url); navigator.clipboard?.writeText(url).catch(() => {});
  };
  const field = "flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm";

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card px-5 py-6 lg:block">
        <div className="mb-8 text-3xl font-medium tracking-tight">PassHub</div>
        {nav.map(([t, items]) => (
          <div key={t} className="mb-6">
            <div className="mb-2 text-[11px] font-semibold text-muted-foreground">{t}</div>
            {items.map(([I, l]) => (
              <div key={l} className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${l === "Hospedagem" ? "bg-secondary font-semibold" : "text-muted-foreground"}`}><I className="h-4 w-4" />{l}</div>
            ))}
          </div>
        ))}
      </aside>

      <main className="flex-1 p-6">
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-[2fr_1fr_1fr_1.3fr_.6fr_auto] md:items-end">
          <label className="text-sm">Destino<div className={field + " mt-2"}><MapPin className="h-4 w-4" /><input className="w-full bg-transparent outline-none" value={s.destino} onChange={e => setS({ ...s, destino: e.target.value })} /></div></label>
          <label className="text-sm">Check-in<div className={field + " mt-2"}><Calendar className="h-4 w-4" /><input type="date" className="w-full bg-transparent outline-none" value={s.checkin} onChange={e => setS({ ...s, checkin: e.target.value })} /></div></label>
          <label className="text-sm">Check-out<div className={field + " mt-2"}><Calendar className="h-4 w-4" /><input type="date" className="w-full bg-transparent outline-none" value={s.checkout} onChange={e => setS({ ...s, checkout: e.target.value })} /></div></label>
          <label className="text-sm">Quartos e hóspedes<div className={field + " mt-2"}><Users className="h-4 w-4" /><input className="w-full bg-transparent outline-none" value={s.hospedes} onChange={e => setS({ ...s, hospedes: e.target.value })} /></div></label>
          <label className="text-sm">RAV<div className={field + " mt-2"}><select className="w-full bg-transparent outline-none" value={s.rav} onChange={e => setS({ ...s, rav: +e.target.value })}>{[0, 5, 10, 15, 20].map(v => <option key={v} value={v}>{v}%</option>)}</select></div></label>
          <button className="h-11 rounded-xl bg-primary px-10 text-sm font-bold text-primary-foreground hover:opacity-90">BUSCAR</button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_.75fr]">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-2xl font-semibold">Hotéis encontrados</h1>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground"><Filter className="h-4 w-4" />Filtros</button>
                <button onClick={() => setSort(sort === "asc" ? "desc" : "asc")} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground">{sort === "asc" ? "Mais barato" : "Mais caro"}<ChevronDown className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mb-4 flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4"><SearchIcon className="h-4 w-4 text-muted-foreground" /><input placeholder="Buscar nos hotéis..." className="w-full bg-transparent text-sm outline-none" value={q} onChange={e => setQ(e.target.value)} /></div>
            <div className="space-y-3">
              {list.map(h => {
                const on = sel.includes(h.id); const p = price(h.nightly);
                return (
                  <div key={h.id} className={`flex overflow-hidden rounded-2xl border bg-card transition ${on ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
                    <img src={h.image} alt={h.name} loading="lazy" width={944} height={704} className="h-36 w-44 shrink-0 object-cover" />
                    <div className="flex flex-1 flex-col p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold">{h.name}</div>
                        <div className="flex items-center gap-2">
                          <div className="flex">{Array.from({ length: h.stars }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-star text-star" />)}</div>
                          <button aria-label="Selecionar" onClick={() => toggle(h.id)} className={`grid h-6 w-6 place-items-center rounded-full border-2 ${on ? "border-primary" : "border-border"}`}>{on && <span className="h-3 w-3 rounded-full bg-primary" />}</button>
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{h.address}</span></div>
                      <div className="mt-3 flex items-baseline gap-1"><span className="text-xl font-bold">{brl(p)}</span><span className="text-xs text-muted-foreground">/ noite</span><CreditCard className="ml-2 h-4 w-4 text-muted-foreground" /></div>
                      <div className="text-[11px] text-muted-foreground">Total de {brl(p * nights)}</div>
                      <div className="mt-auto flex items-end justify-between">
                        <span className="rounded-md bg-success px-2 py-1 text-xs text-success-foreground">Comissão: {brl(p * COMMISSION)}</span>
                        <button onClick={() => toggle(h.id)} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-ink-foreground">{on ? "Remover" : "Adicionar"}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="space-y-4">
            <div className="relative h-[380px] overflow-hidden rounded-2xl border border-border bg-secondary">
              <div className="absolute left-[5%] top-[40%] h-[55%] w-[45%] rounded-[45%] bg-success opacity-70" />
              <div className="absolute right-[2%] top-[55%] h-[30%] w-[25%] rounded-[40%] bg-star opacity-15" />
              {HOTELS.map(h => (
                <button key={h.id} onClick={() => toggle(h.id)} style={{ left: `${h.x}%`, top: `${h.y}%` }} className={`absolute -translate-x-1/2 rounded-full border px-2 py-1 text-xs font-bold shadow ${sel.includes(h.id) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{brl(Math.round(price(h.nightly) * nights)).replace(",00", "")}</button>
              ))}
              <span className="absolute bottom-[18%] left-[4%] text-xs text-muted-foreground">Rio Quente</span>
              <span className="absolute left-[60%] top-[38%] text-sm text-muted-foreground">Caldas Novas</span>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex justify-between"><h2 className="font-semibold">Seu resumo</h2><span className="text-sm text-muted-foreground">{sel.length}/{MAX}</span></div>
              {sel.length === 0 && <p className="text-sm text-muted-foreground">Selecione até {MAX} hotéis para montar a proposta.</p>}
              <div className="space-y-2">
                {sel.map(id => { const h = HOTELS.find(x => x.id === id)!; return (
                  <div key={id} className="rounded-xl border border-border p-3">
                    <div className="flex justify-between"><span className="text-sm font-semibold">{h.name}</span><button aria-label="Remover" onClick={() => toggle(id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></button></div>
                    <div className="text-[11px] text-muted-foreground">{h.address}</div>
                    <div className="mt-1 font-bold">{brl(price(h.nightly))} <span className="text-xs font-normal text-muted-foreground">/ noite</span></div>
                  </div>); })}
              </div>
              <button disabled={!sel.length} onClick={gerar} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Link2 className="h-4 w-4" />Gerar link</button>
              {link && <div className="mt-3 rounded-lg bg-success p-2 text-xs text-success-foreground"><Check className="mr-1 inline h-3 w-3" />Link copiado! <a href={link} target="_blank" rel="noreferrer" className="underline">Abrir proposta</a></div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
