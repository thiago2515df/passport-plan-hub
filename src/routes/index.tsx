import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Plane, Bus, Shield, Building2, Users, MapPin, Calendar, Search as SearchIcon, Filter, Star, CreditCard, Trash2, Link2, Check, ChevronDown, Loader2 } from "lucide-react";
import { COMMISSION, brl, nightsBetween, encodeProposal, type Search, type Hotel } from "@/lib/hotels";
import { searchDestinations, searchHotels } from "@/lib/passhub.functions";
import logoAsset from "@/assets/excursao-brasilia.png.asset.json";
import { HotelPhoto, HotelGallery } from "@/components/HotelGallery";

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
  const findDest = useServerFn(searchDestinations);
  const findHotels = useServerFn(searchHotels);
  const [s, setS] = useState<Search>({ destino: "", checkin: "2026-11-16", checkout: "2026-11-18", hospedes: "", rav: 0 });
  const [destId, setDestId] = useState("");
  const [sugs, setSugs] = useState<{ id: string; name: string; type: string }[]>([]);
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState<number[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [gallery, setGallery] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [sel, setSel] = useState<string[]>([]);
  const [link, setLink] = useState("");
  const nights = nightsBetween(s.checkin, s.checkout);
  const hosp = `${rooms} quarto${rooms > 1 ? "s" : ""} · ${adults + kids.length} hóspede${adults + kids.length > 1 ? "s" : ""}`;

  useEffect(() => {
    if (destId || s.destino.trim().length < 3) { setSugs([]); return; }
    const t = setTimeout(() => findDest({ data: { q: s.destino.trim().slice(0, 80) } }).then(r => setSugs(r.items.slice(0, 8))).catch(() => {}), 350);
    return () => clearTimeout(t);
  }, [s.destino, destId]);

  const buscar = async () => {
    if (!destId) { setErr("Escolha um destino da lista de sugestões."); return; }
    setErr(""); setLoading(true); setSel([]); setLink("");
    try {
      const r = await findHotels({ data: { destinationId: destId, checkinDate: s.checkin, nights: Math.min(30, nights), adults, childAges: kids, rooms, rav: s.rav } });
      setHotels(r.hotels); if (r.error) setErr(r.error); else if (!r.hotels.length) setErr("Nenhum hotel encontrado para essa busca.");
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  };

  const list = useMemo(() => hotels.filter(h => (h.name ?? "").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === "asc" ? a.total - b.total : b.total - a.total), [hotels, q, sort]);

  const toggle = (id: string) => { setLink(""); setSel(p => p.includes(id) ? p.filter(x => x !== id) : p.length < MAX ? [...p, id] : p); };
  const gerar = () => {
    const chosen = sel.map(id => hotels.find(h => h.id === id)!).map(({ id: _i, x: _x, y: _y, ...h }) => ({ ...h, name: h.name.slice(0, 120) }));
    const url = `${window.location.origin}/proposta?t=${encodeURIComponent(encodeProposal({ s: { ...s, hospedes: hosp }, hotels: chosen }))}`;
    setLink(url); navigator.clipboard?.writeText(url).catch(() => {});
  };
  const field = "flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm";
  const num = "w-14 rounded-md border border-border bg-card px-2 py-1";

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card px-5 py-6 lg:block">
        <img src={logoAsset.url} alt="Excursão Brasília" className="mb-8 w-40" />
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
          <label className="relative text-sm">Destino<div className={field + " mt-2"}><MapPin className="h-4 w-4" /><input placeholder="Cidade ou região" className="w-full bg-transparent outline-none" value={s.destino} onChange={e => { setDestId(""); setS({ ...s, destino: e.target.value }); }} /></div>
            {sugs.length > 0 && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              {sugs.map((d, i) => <button type="button" key={d.id + i} onClick={() => { setDestId(d.id); setS({ ...s, destino: d.name }); setSugs([]); }} className="block w-full px-4 py-2 text-left text-sm hover:bg-secondary"><span className="mr-2 text-[10px] font-semibold text-muted-foreground">{d.type}</span>{d.name}</button>)}
            </div>}
          </label>
          <label className="text-sm">Check-in<div className={field + " mt-2"}><Calendar className="h-4 w-4" /><input type="date" className="w-full bg-transparent outline-none" value={s.checkin} onChange={e => setS({ ...s, checkin: e.target.value })} /></div></label>
          <label className="text-sm">Check-out<div className={field + " mt-2"}><Calendar className="h-4 w-4" /><input type="date" className="w-full bg-transparent outline-none" value={s.checkout} onChange={e => setS({ ...s, checkout: e.target.value })} /></div></label>
          <details className="relative text-sm"><summary className="list-none">Quartos e hóspedes<div className={field + " mt-2 cursor-pointer"}><Users className="h-4 w-4" />{hosp}</div></summary>
            <div className="absolute z-20 mt-1 w-64 space-y-2 rounded-xl border border-border bg-card p-3 shadow-lg">
              <div className="flex justify-between">Quartos<input type="number" min={1} max={9} className={num} value={rooms} onChange={e => setRooms(Math.max(1, Math.min(9, +e.target.value)))} /></div>
              <div className="flex justify-between">Adultos<input type="number" min={1} max={9} className={num} value={adults} onChange={e => setAdults(Math.max(1, Math.min(9, +e.target.value)))} /></div>
              <div className="flex justify-between">Crianças<input type="number" min={0} max={4} className={num} value={kids.length} onChange={e => { const n = Math.max(0, Math.min(4, +e.target.value)); setKids(k => Array.from({ length: n }, (_, i) => k[i] ?? 7)); }} /></div>
              {kids.map((a, i) => <div key={i} className="flex justify-between text-xs text-muted-foreground">Idade criança {i + 1}<input type="number" min={0} max={17} className={num} value={a} onChange={e => setKids(k => k.map((v, j) => j === i ? Math.max(0, Math.min(17, +e.target.value)) : v))} /></div>)}
            </div>
          </details>
          <label className="text-sm">RAV<div className={field + " mt-2"}><select className="w-full bg-transparent outline-none" value={s.rav} onChange={e => setS({ ...s, rav: +e.target.value })}>{[0, 5, 10, 15, 20].map(v => <option key={v} value={v}>{v}%</option>)}</select></div></label>
          <button onClick={buscar} disabled={loading} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-10 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}BUSCAR</button>
        </div>
        {err && <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{err}</div>}

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_.75fr]">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-2xl font-semibold">Hotéis encontrados {hotels.length > 0 && <span className="text-base font-normal text-muted-foreground">({hotels.length})</span>}</h1>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground"><Filter className="h-4 w-4" />Filtros</button>
                <button onClick={() => setSort(sort === "asc" ? "desc" : "asc")} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground">{sort === "asc" ? "Mais barato" : "Mais caro"}<ChevronDown className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mb-4 flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4"><SearchIcon className="h-4 w-4 text-muted-foreground" /><input placeholder="Buscar nos hotéis..." className="w-full bg-transparent text-sm outline-none" value={q} onChange={e => setQ(e.target.value)} /></div>
            {loading && <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando nas operadoras... pode levar até 1 minuto.</div>}
            {!loading && !hotels.length && !err && <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Escolha o destino, as datas e clique em BUSCAR.</div>}
            <div className="space-y-3">
              {list.map(h => {
                const on = sel.includes(h.id);
                return (
                  <div key={h.id} className={`flex overflow-hidden rounded-2xl border bg-card transition ${on ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
                    <button type="button" onClick={() => setGallery(h)} className="shrink-0" aria-label="Ver fotos"><HotelPhoto hotel={h} /></button>
                    <div className="flex flex-1 flex-col p-3">
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => setGallery(h)} className="text-left font-semibold hover:underline">{h.name}</button>
                        <div className="flex items-center gap-2">
                          <div className="flex">{Array.from({ length: h.stars }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-star text-star" />)}</div>
                          <button aria-label="Selecionar" onClick={() => toggle(h.id)} className={`grid h-6 w-6 place-items-center rounded-full border-2 ${on ? "border-primary" : "border-border"}`}>{on && <span className="h-3 w-3 rounded-full bg-primary" />}</button>
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{h.address}</span></div>
                      {h.room && <div className="mt-1 truncate text-xs text-muted-foreground">{h.room}</div>}
                      <div className="mt-2 flex items-baseline gap-1"><span className="text-xl font-bold">{brl(h.nightly)}</span><span className="text-xs text-muted-foreground">/ noite</span><CreditCard className="ml-2 h-4 w-4 text-muted-foreground" /></div>
                      <div className="text-[11px] text-muted-foreground">Total de {brl(h.total)}</div>
                      <div className="mt-auto flex items-end justify-between">
                        <span className="rounded-md bg-success px-2 py-1 text-xs text-success-foreground">Comissão: {brl(h.total * COMMISSION)}</span>
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
              {list.slice(0, 40).map(h => (
                <button key={h.id} onClick={() => toggle(h.id)} style={{ left: `${h.x}%`, top: `${h.y}%` }} className={`absolute -translate-x-1/2 rounded-full border px-2 py-1 text-xs font-bold shadow ${sel.includes(h.id) ? "z-10 border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{brl(Math.round(h.total)).replace(",00", "")}</button>
              ))}
              {!hotels.length && <span className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">O mapa aparece depois da busca</span>}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex justify-between"><h2 className="font-semibold">Seu resumo</h2><span className="text-sm text-muted-foreground">{sel.length}/{MAX}</span></div>
              {sel.length === 0 && <p className="text-sm text-muted-foreground">Selecione até {MAX} hotéis para montar a proposta.</p>}
              <div className="space-y-2">
                {sel.map(id => { const h = hotels.find(x => x.id === id); if (!h) return null; return (
                  <div key={id} className="rounded-xl border border-border p-3">
                    <div className="flex justify-between"><span className="text-sm font-semibold">{h.name}</span><button aria-label="Remover" onClick={() => toggle(id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></button></div>
                    <div className="text-[11px] text-muted-foreground">{h.address}</div>
                    <div className="mt-1 font-bold">{brl(h.nightly)} <span className="text-xs font-normal text-muted-foreground">/ noite</span></div>
                  </div>); })}
              </div>
              <input placeholder="Nome do cliente" value={s.cliente ?? ""} onChange={e => { setLink(""); setS({ ...s, cliente: e.target.value }); }} className="mt-4 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm" />
              <input placeholder="Cidade de origem (ex.: Brasília)" value={s.origem ?? ""} onChange={e => { setLink(""); setS({ ...s, origem: e.target.value }); }} className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm" />
              <button disabled={!sel.length} onClick={gerar} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Link2 className="h-4 w-4" />Gerar link</button>
              {link && <div className="mt-3 rounded-lg bg-success p-2 text-xs text-success-foreground"><Check className="mr-1 inline h-3 w-3" />Link copiado! <a href={link} target="_blank" rel="noreferrer" className="underline">Abrir proposta</a></div>}
            </div>
          </div>
        </div>
      </main>
      {gallery && <HotelGallery hotel={gallery} onClose={() => setGallery(null)} />}
    </div>
  );
}
