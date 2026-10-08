import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Plane, Bus, Shield, Building2, Users, MapPin, Calendar, Search as SearchIcon, Filter, Star, CreditCard, Trash2, Link2, Check, ChevronDown, Loader2, Settings, UserRound } from "lucide-react";
import { COMMISSION, brl, nightsBetween, encodeProposal, makeTransport, isCaldasNovas, iataOf, cityIata, type Flight, type TransportMode, type Search, type Hotel } from "@/lib/hotels";
import { searchDestinations, searchHotels } from "@/lib/passhub.functions";
import logoAsset from "@/assets/excursao-brasilia.png.asset.json";
import { HotelPhoto, HotelGallery } from "@/components/HotelGallery";
import { TransportPanel } from "@/components/TransportPanel";
import { FlightPicker } from "@/components/FlightPicker";
import { searchFlights } from "@/lib/flights.functions";
import { saveProposal } from "@/lib/proposals.functions";
import { Button } from "@/components/ui/button";
import { Calendar as DayPicker } from "@/components/ui/calendar";
import { ptBR } from "react-day-picker/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCitySuggestions } from "@/hooks/use-city-suggestions";
import { useAccess } from "@/components/AccessProvider";

const toD = (iso: string) => new Date(iso + "T12:00");
const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtD = (iso: string) => toD(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pacotes — Excursão Brasília" },
      { name: "description", content: "Busque hotéis, selecione opções e gere um link de proposta para o cliente." },
      { property: "og:title", content: "Pacotes — Excursão Brasília" },
      { property: "og:description", content: "Busque hotéis e gere propostas em segundos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const MAX = 3;
const nav = [
  ["COTAÇÕES", [[Building2, "Pacotes"], [Plane, "Aéreo"], [Bus, "Rodoviário"], [Shield, "Seguros"]]],
] as const;

function Index() {
  const access = useAccess();
  const findHotels = useServerFn(searchHotels);
  const [s, setS] = useState<Search>({ destino: "", checkin: "2026-11-16", checkout: "2026-11-18", hospedes: "", rav: 0 });
  const [destId, setDestId] = useState("");
  const [cityFocus, setCityFocus] = useState<"origin" | "destination" | null>(null);
  const [chosenOrigin, setChosenOrigin] = useState("");
  const originCities = useCitySuggestions(access.allowed && cityFocus === "origin" && s.origem !== chosenOrigin ? s.origem ?? "" : "");
  const destinationCities = useCitySuggestions(access.allowed && cityFocus === "destination" && !destId ? s.destino : "");
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
  const [uploading, setUploading] = useState(false);
  const findFlights = useServerFn(searchFlights);
  type Leg = { list: Flight[]; loading: boolean; error?: string | undefined };
  const empty: Leg = { list: [], loading: false };
  const [outF, setOutF] = useState<Leg>(empty);
  const [backF, setBackF] = useState<Leg>(empty);
  const [destIata, setDestIata] = useState("");
  const [picking, setPicking] = useState(false);
  const [calMonth, setCalMonth] = useState<Date>(() => toD("2026-11-16"));
  const [pickF, setPickF] = useState<{ out?: Flight | undefined; back?: Flight | undefined }>({});
  const transport = s.transport ?? makeTransport("none", s.destino);
  const changeDestination = (destination: string) => setS(previous => {
    const current = previous.transport;
    const changedCity = previous.destino.split(",")[0] !== destination.split(",")[0];
    return { ...previous, destino: destination, transport: current && changedCity && (isCaldasNovas(destination) !== isCaldasNovas(previous.destino) || current.standard) ? makeTransport(current.mode, destination) : current ?? makeTransport("none", destination) };
  });
  useEffect(() => { setLink(""); }, [s, rooms, adults, kids]);
  const nights = nightsBetween(s.checkin, s.checkout);
  const hosp = `${rooms} quarto${rooms > 1 ? "s" : ""} · ${adults + kids.length} hóspede${adults + kids.length > 1 ? "s" : ""}`;

  const buscar = async () => {
    if (!access.allowed) { setErr("Seu acesso precisa ser liberado pelo administrador."); return; }
    if (!destId) { setErr("Escolha um destino da lista de sugestões."); return; }
    setErr(""); setLoading(true); setSel([]); setLink("");
    if (transport.mode === "air") {
      const from = iataOf(s.origem) || cityIata(s.origem ?? ""), to = iataOf(destIata) || cityIata(s.destino);
      setPickF({});
      if (!from || !to) { setOutF({ list: [], loading: false, error: "Não reconheci o aeroporto da origem ou do destino. Escreva a origem como 'Brasília (BSB)' ou preencha o campo do aeroporto de destino." }); setBackF(empty); }
      else {
        const run = (a: string, b: string, date: string, set: (l: Leg) => void) => { set({ list: [], loading: true }); findFlights({ data: { from: a, to: b, date, adults, children: kids.length } }).then(r => set({ list: r.flights, loading: false, error: r.error ?? (r.flights.length ? undefined : "Nenhum voo encontrado.") })).catch(e => set({ list: [], loading: false, error: (e as Error).message })); };
        run(from, to, s.checkin, setOutF); run(to, from, s.checkout, setBackF);
      }
    }
    try {
      const r = await findHotels({ data: { destinationId: destId, checkinDate: s.checkin, nights: Math.min(30, nights), adults, childAges: kids, rooms, rav: s.rav } });
      setHotels(r.hotels); if (r.error) setErr(r.error); else if (!r.hotels.length) setErr("Nenhum hotel encontrado para essa busca.");
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  };

  const list = useMemo(() => hotels.filter(h => (h.name ?? "").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === "asc" ? a.total - b.total : b.total - a.total), [hotels, q, sort]);

  const toggle = (id: string) => { setLink(""); setSel(p => p.includes(id) ? p.filter(x => x !== id) : p.length < MAX ? [...p, id] : p); };
  const saveProp = useServerFn(saveProposal);
  const [saving, setSaving] = useState(false);
  const gerar = async () => {
    const chosen = sel.map(id => hotels.find(h => h.id === id)).filter((h): h is Hotel => Boolean(h)).map(({ id: _i, x: _x, y: _y, ...h }) => ({ ...h, name: h.name.slice(0, 120) }));
    setSaving(true);
    try {
      const { code } = await saveProp({ data: { payload: encodeProposal({ s: { ...s, hospedes: hosp }, hotels: chosen }) } });
      const url = `${window.location.origin}/p/${code}`;
      setLink(url); navigator.clipboard?.writeText(url).catch(() => {});
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };
  const choose = (k: "out" | "back", f: Flight) => {
    const next = { ...pickF, [k]: f }; setPickF(next);
    setS(prev => {
      const t = prev.transport ?? makeTransport("air", prev.destino);
      const leg = (x: Flight) => ({ company: `${x.airline} · ${x.flightNumber}`, departure: x.departure, arrival: x.arrival, from: x.from, to: x.to, duration: x.duration, stops: x.stops });
      return { ...prev, transport: { ...t,
        ...(next.out ? { outbound: { ...t.outbound, ...leg(next.out) } } : {}),
        ...(next.back ? { inbound: { ...t.inbound, ...leg(next.back) } } : {}),
         price: (next.out?.price ?? 0) + (next.back?.price ?? 0), travelClass: f.travelClass, bags: f.bags } };
    });
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
              <div key={l} className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${l === "Pacotes" ? "bg-secondary font-semibold" : "text-muted-foreground"}`}><I className="h-4 w-4" />{l}</div>
            ))}
          </div>
        ))}
        <div className="space-y-1 border-t border-border pt-4">
          <Button variant="ghost" className="w-full justify-start" asChild><Link to="/vendedor"><UserRound className="h-4 w-4" />Minha página</Link></Button>
          <Button variant="ghost" className="w-full justify-start" asChild><Link to="/configuracoes"><Settings className="h-4 w-4" />Configurações</Link></Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-6">
        <div className="mb-4 flex justify-end gap-2 lg:hidden"><Button variant="outline" asChild><Link to="/vendedor"><UserRound className="h-4 w-4" />Minha página</Link></Button><Button variant="outline" asChild><Link to="/configuracoes"><Settings className="h-4 w-4" />Configurações</Link></Button></div>
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-2 2xl:grid-cols-[1.4fr_1.6fr_1.4fr_1.3fr_1.1fr_auto] md:items-end">
          <div className="relative text-sm"><label htmlFor="origin-city">Origem</label><div className={field + " mt-2"}><Plane className="h-4 w-4" /><input id="origin-city" autoComplete="off" placeholder="Ex.: Brasília (BSB)" className="min-w-0 w-full bg-transparent outline-none" value={s.origem ?? ""} onFocus={() => setCityFocus("origin")} onBlur={() => setCityFocus(null)} onChange={e => { setChosenOrigin(""); setS({ ...s, origem: e.target.value }); }} /></div>
            {cityFocus === "origin" && (originCities.loading || originCities.error || originCities.items.length > 0) && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
              {originCities.loading && <p className="flex items-center gap-2 px-4 py-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando cidades…</p>}
              {originCities.error && <p className="px-4 py-2 text-destructive">{originCities.error}</p>}
              {originCities.items.map((d, i) => <Button variant="ghost" type="button" key={d.id + i} onMouseDown={e => e.preventDefault()} onClick={() => { setChosenOrigin(d.name); setS(prev => ({ ...prev, origem: d.name })); setCityFocus(null); }} className="h-auto w-full justify-start whitespace-normal rounded-none px-4 py-2 text-left"><span className="text-[10px] text-muted-foreground">{d.type}</span>{d.name}</Button>)}
            </div>}
          </div>
          <div className="relative text-sm"><label htmlFor="destination-city">Destino</label><div className={field + " mt-2"}><MapPin className="h-4 w-4" /><input id="destination-city" autoComplete="off" disabled={uploading} placeholder="Cidade ou região" className="min-w-0 w-full bg-transparent outline-none" value={s.destino} onFocus={() => setCityFocus("destination")} onBlur={() => setCityFocus(null)} onChange={e => { setDestId(""); changeDestination(e.target.value); }} /></div>
            {cityFocus === "destination" && (destinationCities.loading || destinationCities.error || destinationCities.items.length > 0) && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
              {destinationCities.loading && <p className="flex items-center gap-2 px-4 py-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando cidades…</p>}
              {destinationCities.error && <p className="px-4 py-2 text-destructive">{destinationCities.error}</p>}
              {destinationCities.items.map((d, i) => <Button variant="ghost" type="button" key={d.id + i} disabled={uploading} onMouseDown={e => e.preventDefault()} onClick={() => { setDestId(d.id); changeDestination(d.name); setCityFocus(null); }} className="h-auto w-full justify-start whitespace-normal rounded-none px-4 py-2 text-left"><span className="text-[10px] text-muted-foreground">{d.type}</span>{d.name}</Button>)}
            </div>}
          </div>
          <div className="text-sm">Ida e volta
            <Popover>
              <PopoverTrigger asChild><button type="button" className={field + " mt-2 w-full text-left"}><Calendar className="h-4 w-4" />{fmtD(s.checkin)} → {fmtD(s.checkout)}</button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <DayPicker mode="range" locale={ptBR} numberOfMonths={2} month={calMonth} onMonthChange={setCalMonth} disabled={{ before: new Date() }} selected={{ from: toD(s.checkin), to: picking ? undefined : toD(s.checkout) }}
                  onSelect={(_r, day) => {
                    if (!day) return;
                    if (!picking || day <= toD(s.checkin)) { setS(prev => ({ ...prev, checkin: isoD(day), checkout: isoD(new Date(day.getTime() + 86400000)) })); setPicking(true); return; }
                    setS(prev => ({ ...prev, checkout: isoD(day) })); setPicking(false);
                  }}
                  className="pointer-events-auto p-3" />
                <p className="px-3 pb-3 text-xs text-muted-foreground">{picking ? "Agora clique no dia da volta." : "Clique na ida e depois na volta."} {nights} {nights === 1 ? "noite" : "noites"}.</p>
              </PopoverContent>
            </Popover>
          </div>
          <details className="relative text-sm"><summary className="list-none">Quartos e hóspedes<div className={field + " mt-2 cursor-pointer"}><Users className="h-4 w-4" />{hosp}</div></summary>
            <div className="absolute z-20 mt-1 w-64 space-y-2 rounded-xl border border-border bg-card p-3 shadow-lg">
              <div className="flex justify-between">Quartos<input type="number" min={1} max={9} className={num} value={rooms} onChange={e => setRooms(Math.max(1, Math.min(9, +e.target.value)))} /></div>
              <div className="flex justify-between">Adultos<input type="number" min={1} max={9} className={num} value={adults} onChange={e => setAdults(Math.max(1, Math.min(9, +e.target.value)))} /></div>
              <div className="flex justify-between">Crianças<input type="number" min={0} max={4} className={num} value={kids.length} onChange={e => { const n = Math.max(0, Math.min(4, +e.target.value)); setKids(k => Array.from({ length: n }, (_, i) => k[i] ?? 7)); }} /></div>
              {kids.map((a, i) => <div key={i} className="flex justify-between text-xs text-muted-foreground">Idade criança {i + 1}<input type="number" min={0} max={17} className={num} value={a} onChange={e => setKids(k => k.map((v, j) => j === i ? Math.max(0, Math.min(17, +e.target.value)) : v))} /></div>)}
            </div>
          </details>
          <label className="text-sm">Transporte<div className={field + " mt-2"}><select aria-label="Transporte" disabled={uploading} className="min-w-0 w-full bg-transparent outline-none" value={transport.mode} onChange={e => setS(previous => ({ ...previous, transport: makeTransport(e.target.value as TransportMode, previous.destino) }))}><option value="none">Sem transporte</option><option value="air">Aéreo</option><option value="bus">Ônibus</option></select></div></label>
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

          <div className="min-w-0 space-y-4">
            {transport.mode === "air" && <>
              <label className="block text-sm">Aeroporto de destino (código)<input aria-label="Aeroporto de destino" placeholder="Ex.: MCZ" maxLength={3} value={destIata} onChange={e => setDestIata(e.target.value.toUpperCase())} className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm" /></label>
              <FlightPicker title="Voos de ida" leg={outF} selected={pickF.out?.id} onSelect={f => choose("out", f)} />
              <FlightPicker title="Voos de volta" leg={backF} selected={pickF.back?.id} onSelect={f => choose("back", f)} />
            </>}
            {transport.mode === "bus" ? <TransportPanel s={s} value={transport} onBusyChange={setUploading} onChange={value => setS(previous => ({ ...previous, transport: value }))} /> : transport.mode === "none" ? <div className="relative h-[380px] overflow-hidden rounded-2xl border border-border bg-secondary">
              {list.slice(0, 40).map(h => (
                <button key={h.id} onClick={() => toggle(h.id)} style={{ left: `${h.x}%`, top: `${h.y}%` }} className={`absolute -translate-x-1/2 rounded-full border px-2 py-1 text-xs font-bold shadow ${sel.includes(h.id) ? "z-10 border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{brl(Math.round(h.total)).replace(",00", "")}</button>
              ))}
              {!hotels.length && <span className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">O mapa aparece depois da busca</span>}
            </div> : null}

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
               {(pickF.out || pickF.back) && <div className="mt-3 space-y-2">
                 <h3 className="text-sm font-semibold">Voos selecionados</h3>
                 {([["Ida", pickF.out], ["Volta", pickF.back]] as const).map(([label, f]) => f && (
                   <div key={label} className="rounded-xl border border-primary/40 bg-primary/5 p-3">
                     <div className="flex justify-between"><span className="text-sm font-semibold">{label} · {f.airline} {f.flightNumber}</span><button aria-label={`Remover voo de ${label}`} onClick={() => { const k = label === "Ida" ? "out" : "back"; const next = { ...pickF, [k]: undefined }; setPickF(next); setS(prev => { const t = prev.transport; if (!t) return prev; return { ...prev, transport: { ...t, price: (next.out?.price ?? 0) + (next.back?.price ?? 0) } }; }); }}><Trash2 className="h-4 w-4 text-muted-foreground" /></button></div>
                     <div className="text-[11px] text-muted-foreground">{f.from} → {f.to} · {f.departure} – {f.arrival}</div>
                     <div className="mt-1 font-bold">{brl(f.price)}</div>
                   </div>))}
               </div>}
               <input placeholder="Nome do cliente" value={s.cliente ?? ""} onChange={e => { setLink(""); setS({ ...s, cliente: e.target.value }); }} className="mt-4 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm" />
               <Button disabled={!access.allowed || !sel.length || uploading || saving} onClick={gerar} className="mt-4 h-11 w-full"><Link2 className="h-4 w-4" />{uploading ? "Enviando passagem…" : saving ? "Gerando…" : "Gerar link"}</Button>
               {!access.loading && !access.allowed && <p className="mt-2 text-xs text-muted-foreground">Geração de propostas disponível após a liberação do seu acesso.</p>}
              {link && <div className="mt-3 rounded-lg bg-success p-2 text-xs text-success-foreground"><Check className="mr-1 inline h-3 w-3" />Link copiado! <a href={link} target="_blank" rel="noreferrer" className="underline">Abrir proposta</a></div>}
            </div>
          </div>
        </div>
      </main>
      {gallery && <HotelGallery hotel={gallery} onClose={() => setGallery(null)} />}
    </div>
  );
}
