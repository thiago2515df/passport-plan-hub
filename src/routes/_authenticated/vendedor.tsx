import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ManagementNav } from "@/components/ManagementNav";
import { useAccess } from "@/components/AccessProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { listMyProposals } from "@/lib/settings.functions";
import { CommissionSettings } from "@/components/CommissionSettings";
import { packagePricing } from "@/lib/package-pricing";
import { setProposalStatus } from "@/lib/proposals.functions";
import { decodeProposal, brl, nightsBetween } from "@/lib/hotels";
import { proposalShareMessage } from "@/lib/proposal-message";
import { searchFlights } from "@/lib/flights.functions";
import { FileText, Send, CheckCircle2, Clock, Plus, ExternalLink, Pencil, Phone, UserRound, CalendarDays, MapPin, XCircle, Search, GripVertical, Loader2, Plane, ArrowRightLeft, Calendar, Users, Search as SearchIcon } from "lucide-react";

type Flight = NonNullable<Awaited<ReturnType<typeof searchFlights>>["flights"]>[number];

const boardOptions = (id: string) => queryOptions({ queryKey: ["proposal-board", id], queryFn: () => listMyProposals(), refetchInterval: 30000 });
export const Route = createFileRoute("/_authenticated/vendedor")({
  validateSearch: (search: Record<string, unknown>) => ({ q: typeof search['q'] === "string" ? search['q'] : "" }),
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(boardOptions(context.user.id)); },
  errorComponent: ({ error }) => <BoardError message={error instanceof Error ? error.message : "Não foi possível carregar as propostas."} />,
  notFoundComponent: () => <BoardError message="Página não encontrada." />,
  head: () => ({ meta: [{ title: "Quadro de propostas — Excursão Brasília" }, { name: "description", content: "Acompanhamento das propostas de viagem e resultados da equipe." }, { property: "og:title", content: "Quadro de propostas — Excursão Brasília" }, { property: "og:description", content: "Propostas criadas, aguardando resposta e concluídas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: SellerPage,
});
function BoardError({ message }: { message: string }) { const router = useRouter(); return <div className="flex min-h-screen"><ManagementNav current="seller" /><main className="p-8"><p role="alert">{message}</p><Button onClick={() => router.invalidate()}>Tentar novamente</Button></main></div>; }
type Status = "created" | "awaiting" | "approved" | "cancelled";
const columns = [{ id: "created", title: "Propostas criadas", icon: FileText, tone: "text-primary", line: "border-primary" }, { id: "awaiting", title: "Aguardando resposta", icon: Clock, tone: "text-chart-1", line: "border-chart-1" }, { id: "closed", title: "Concluídas", icon: CheckCircle2, tone: "text-success-foreground", line: "border-success-foreground" }] as const;
const dateTime = (value: string) => new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const date = (value: string) => new Date(value + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

function SellerPage() {
  const access = useAccess(); 
  const { user } = Route.useRouteContext(); 
  const { q } = Route.useSearch(); 
  const navigate = Route.useNavigate();
  const { data: rows } = useSuspenseQuery(boardOptions(user.id)); 
  const client = useQueryClient(); 
  const changeStatus = useServerFn(setProposalStatus);
  const [pending, setPending] = useState<{ code: string; status: Status; client: string; phone?: string } | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const pendingSearch = pending ? decodeProposal(rows.find(row => row.code === pending.code)?.payload ?? "")?.s : null;
  const shareMessage = pending && pendingSearch ? proposalShareMessage(pendingSearch, pending.code) : "";
  const [dragged, setDragged] = useState<string | null>(null);
  const mutation = useMutation({ mutationFn: changeStatus, onSuccess: async () => { setPending(null); await client.invalidateQueries({ queryKey: ["proposal-board"] }); await client.invalidateQueries({ queryKey: ["settings"] }); } });
  const filtered = rows.filter(row => { const p = decodeProposal(row.payload); return `${p?.s.cliente ?? ""} ${p?.s.destino ?? ""} ${row.seller_name} ${row.code}`.toLowerCase().includes(q.toLowerCase()); });
  const request = (code: string, status: Status) => { const row = rows.find(r => r.code === code); if (!row) return; const s = decodeProposal(row.payload)?.s; mutation.reset(); setCopyState("idle"); setPending({ code, status, client: s?.cliente || "Cliente", ...(s?.telefone ? { phone: s.telefone } : {}) }); };

  // Flight state
  const [tripType, setTripType] = useState<"roundtrip" | "oneway">("roundtrip");
  const [travelClass] = useState("Econômica");
  const [rav] = useState("0%");
  const [passengers, setPassengers] = useState(1);
  const [origin, setOrigin] = useState("BSB");
  const [destination, setDestination] = useState("GRU");
  const [departureDate, setDepartureDate] = useState("2026-06-10");
  const [returnDate, setReturnDate] = useState("2026-06-17");

  const [step, setStep] = useState<"outbound" | "inbound" | "done">("outbound");
  const [selectedOutbound, setSelectedOutbound] = useState<Flight | null>(null);
  const [selectedInbound, setSelectedInbound] = useState<Flight | null>(null);
  const [sortBy] = useState<"price" | "duration">("price");

  const [outboundQuery, setOutboundQuery] = useState<{ flights: Flight[]; loading: boolean; error?: string | undefined }>({
    flights: [],
    loading: false,
  });
  const [inboundQuery, setInboundQuery] = useState<{ flights: Flight[]; loading: boolean; error?: string | undefined }>({
    flights: [],
    loading: false,
  });

  const searchFn = useServerFn(searchFlights);

  async function handleSearch() {
    setStep("outbound");
    setSelectedOutbound(null);
    setSelectedInbound(null);

    setOutboundQuery({ flights: [], loading: true });
    try {
      const res = await searchFn({
        data: {
          from: origin.toUpperCase(),
          to: destination.toUpperCase(),
          date: departureDate,
          adults: passengers,
          children: 0,
        },
      });
      const sorted = [...(res.flights ?? [])].sort((a, b) => (sortBy === "price" ? a.price - b.price : a.duration.localeCompare(b.duration)));
      setOutboundQuery({ flights: sorted, loading: false, error: res.error });
    } catch (e) {
      setOutboundQuery({ flights: [], loading: false, error: (e as Error).message });
    }

    if (tripType === "roundtrip") {
      setInboundQuery({ flights: [], loading: true });
      try {
        const res = await searchFn({
          data: {
            from: destination.toUpperCase(),
            to: origin.toUpperCase(),
            date: returnDate,
            adults: passengers,
            children: 0,
          },
        });
        const sorted = [...(res.flights ?? [])].sort((a, b) => (sortBy === "price" ? a.price - b.price : a.duration.localeCompare(b.duration)));
        setInboundQuery({ flights: sorted, loading: false, error: res.error });
      } catch (e) {
        setInboundQuery({ flights: [], loading: false, error: (e as Error).message });
      }
    }
  }

  function handleSelectOutbound(f: Flight) {
    setSelectedOutbound(f);
    if (tripType === "roundtrip") {
      setStep("inbound");
    } else {
      setStep("done");
    }
  }

  function handleSelectInbound(f: Flight) {
    setSelectedInbound(f);
    setStep("done");
  }

  const activeList = step === "outbound" ? outboundQuery.flights : inboundQuery.flights;
  const activeLoading = step === "outbound" ? outboundQuery.loading : inboundQuery.loading;
  const activeError = step === "outbound" ? outboundQuery.error : inboundQuery.error;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <ManagementNav current="seller" />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-7 space-y-10">
        
        {/* ÁREA DE AÉREO RECONSTRUÍDA */}
        <div className="rounded-3xl border border-border bg-card p-4 md:p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full bg-secondary p-1">
                <button onClick={() => setTripType("roundtrip")} className={`rounded-full px-4 py-2 text-xs font-bold transition ${tripType === "roundtrip" ? "bg-foreground text-background shadow" : "text-muted-foreground hover:text-foreground"}`}>Ida e Volta</button>
                <button onClick={() => setTripType("oneway")} className={`rounded-full px-4 py-2 text-xs font-bold transition ${tripType === "oneway" ? "bg-foreground text-background shadow" : "text-muted-foreground hover:text-foreground"}`}>Só ida</button>
              </div>
              <div className="rounded-full border border-border px-4 py-2 text-xs font-bold flex items-center gap-2 bg-background">
                {travelClass} <span className="text-muted-foreground">▾</span>
              </div>
              <div className="rounded-full border border-border px-4 py-2 text-xs font-bold flex items-center gap-2 bg-background">
                Comissão RAV: {rav} <span className="text-muted-foreground">▾</span>
              </div>
            </div>
            <div className="rounded-full border border-border px-4 py-2 text-xs font-bold flex items-center gap-2 bg-background">
              <Users className="h-3.5 w-3.5" /> {passengers} Passageiro(s) <span className="text-muted-foreground">▾</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1fr_1fr_auto] items-center gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">Origem</label>
              <div className="flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-2.5">
                <Plane className="h-4 w-4 text-muted-foreground rotate-45" />
                <input value={origin} onChange={e => setOrigin(e.target.value.toUpperCase().slice(0, 3))} className="w-full bg-transparent text-sm font-bold focus:outline-none" placeholder="BSB" />
              </div>
            </div>

            <button onClick={() => { const tmp = origin; setOrigin(destination); setDestination(tmp); }} className="mt-5 h-10 w-10 rounded-full border border-border bg-secondary flex items-center justify-center hover:bg-muted transition text-muted-foreground">
              <ArrowRightLeft className="h-4 w-4" />
            </button>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">Destino</label>
              <div className="flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-2.5">
                <Plane className="h-4 w-4 text-muted-foreground -rotate-45" />
                <input value={destination} onChange={e => setDestination(e.target.value.toUpperCase().slice(0, 3))} className="w-full bg-transparent text-sm font-bold focus:outline-none" placeholder="GRU" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">Data de ida</label>
              <div className="flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-2.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} className="w-full bg-transparent text-sm font-bold focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">Data de volta</label>
              <div className={`flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-2.5 ${tripType === "oneway" ? "opacity-40 pointer-events-none" : ""}`}>
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <input type="date" disabled={tripType === "oneway"} value={returnDate} onChange={e => setReturnDate(e.target.value)} className="w-full bg-transparent text-sm font-bold focus:outline-none" />
              </div>
            </div>

            <Button onClick={handleSearch} disabled={outboundQuery.loading || inboundQuery.loading} className="mt-5 h-12 rounded-2xl px-8 font-extrabold">
              {outboundQuery.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4 mr-2" />}
              BUSCAR
            </Button>
          </div>

          {/* STEPS & RESULTS */}
          {(outboundQuery.loading || inboundQuery.loading || outboundQuery.flights.length > 0 || inboundQuery.error) && (
            <div className="mt-6 border-t border-border pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">
                  {step === "outbound" && `Selecione o Voo de Ida (${origin} → ${destination})`}
                  {step === "inbound" && `Selecione o Voo de Volta (${destination} → ${origin})`}
                  {step === "done" && "Voos Selecionados com Sucesso!"}
                </h3>
                {selectedOutbound && tripType === "roundtrip" && step !== "done" && (
                  <span className="text-xs bg-secondary px-3 py-1 rounded-full text-muted-foreground">
                    Ida selecionada: {selectedOutbound.airline} - {brl(selectedOutbound.price)}
                  </span>
                )}
              </div>

              {activeLoading && (
                <div className="flex flex-col items-center justify-center p-12 gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm">Buscando os melhores voos e tarifas...</p>
                </div>
              )}

              {activeError && (
                <p className="text-sm text-destructive p-4 bg-destructive/10 rounded-xl">{activeError}</p>
              )}

              {!activeLoading && !activeError && step !== "done" && (
                <div className="space-y-3">
                  {activeList.map((flight, idx) => (
                    <div key={flight.id ?? idx} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-background hover:border-primary transition">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center font-bold text-xs uppercase">
                          {flight.airline.slice(0, 3)}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{flight.airline}</p>
                          <p className="text-xs text-muted-foreground">
                            {flight.departure} ({flight.from}) → {flight.arrival} ({flight.to}) · {flight.duration}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Preço por passageiro</p>
                          <p className="text-base font-extrabold text-primary">{brl(flight.price)}</p>
                        </div>
                        <Button onClick={() => step === "outbound" ? handleSelectOutbound(flight) : handleSelectInbound(flight)} size="sm" className="rounded-xl px-5">
                          Selecionar
                        </Button>
                      </div>
                    </div>
                  ))}
                  {activeList.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum voo encontrado para esta rota/data.</p>
                  )}
                </div>
              )}

              {step === "done" && (
                <div className="p-6 rounded-2xl bg-secondary/50 border border-border space-y-4">
                  <div className="flex items-center gap-2 text-success-foreground font-bold">
                    <CheckCircle2 className="h-5 w-5 text-green-600" /> Voos selecionados para a proposta!
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {selectedOutbound && (
                      <div className="p-3 rounded-xl bg-background border border-border">
                        <p className="font-bold text-muted-foreground mb-1">IDA</p>
                        <p className="font-bold">{selectedOutbound.airline} — {selectedOutbound.from} → {selectedOutbound.to}</p>
                        <p className="text-muted-foreground">{selectedOutbound.departure} às {selectedOutbound.arrival} · {brl(selectedOutbound.price)}</p>
                      </div>
                    )}
                    {selectedInbound && (
                      <div className="p-3 rounded-xl bg-background border border-border">
                        <p className="font-bold text-muted-foreground mb-1">VOLTA</p>
                        <p className="font-bold">{selectedInbound.airline} — {selectedInbound.from} → {selectedInbound.to}</p>
                        <p className="text-muted-foreground">{selectedInbound.departure} às {selectedInbound.arrival} · {brl(selectedInbound.price)}</p>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setStep("outbound"); setSelectedOutbound(null); setSelectedInbound(null); }}>
                    Refazer Seleção de Voos
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PROPOSTAS / VENDAS HEADER E CONTEÚDO ORIGINAL */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{access.admin ? "Visão geral da equipe" : "Meu espaço de vendas"}</p>
            <h1 className="text-3xl font-bold">Propostas</h1>
            <p className="mt-2 text-sm text-muted-foreground">{rows.length} propostas · {rows.filter(r => r.status === "awaiting").length} aguardando resposta</p>
          </div>
          <Button asChild><Link to="/pacotes" search={{}}><Plus />Nova proposta</Link></Button>
        </header>
        <div className="mb-7 flex items-center gap-2 border-b border-border pb-5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input aria-label="Buscar proposta" className="max-w-sm bg-card" placeholder="Cliente, destino ou vendedor" value={q} onChange={e => navigate({ search: { q: e.target.value }, replace: true })} />
        </div>
        <CommissionSettings userId={user.id} />
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
          {columns.map(column => { const cards = filtered.filter(row => column.id === "closed" ? ["approved", "cancelled"].includes(row.status) : row.status === column.id); return <section key={column.id} aria-label={column.title} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragged) request(dragged, column.id === "closed" ? "approved" : column.id); setDragged(null); }} className="min-w-0">
            <div className={`mb-4 flex items-center justify-between border-t-2 ${column.line} pt-4`}><h2 className="flex items-center gap-2 text-sm font-semibold"><column.icon className={`h-4 w-4 ${column.tone}`} />{column.title}</h2><span className="grid h-6 min-w-6 place-items-center rounded-md bg-secondary px-1 text-xs font-semibold">{cards.length}</span></div>
            <div className="min-h-64 space-y-3">{cards.map(row => { const p = decodeProposal(row.payload); const s = p?.s; const minimum = p?.hotels.length ? Math.min(...p.hotels.map(h => packagePricing(h.total, p.s, row.commissions).total)) : null; return <article key={row.code} draggable onDragStart={() => setDragged(row.code)} onDragEnd={() => setDragged(null)} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2"><div><p className="text-[11px] text-muted-foreground">#{row.code}</p><h3 className="mt-1 break-words font-semibold">{s?.cliente || "Cliente não informado"}</h3></div><GripVertical aria-label="Mover proposta" className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" /></div>
              {row.status !== "created" && <span className={`mb-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${row.status === "approved" ? "bg-success text-success-foreground" : row.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`}>{row.status === "approved" ? "Aprovada" : row.status === "cancelled" ? "Cancelada" : "Proposta enviada"}</span>}
              <div className="space-y-2 text-xs"><p className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="break-words">{s?.origem?.split(",")[0] || "Origem"} → {s?.destino?.split(",")[0] || "Destino"}</span></p>{s && <p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />{date(s.checkin)} – {date(s.checkout)} · {nightsBetween(s.checkin, s.checkout)} noites</p>}<p className="break-words text-muted-foreground">{s?.hospedes || "Hóspedes não informados"}</p>{s?.telefone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{s.telefone}</p>}{s?.email && <p className="break-all text-muted-foreground">{s.email}</p>}
              {p?.hotels.map((hotel, index) => <p key={index} className="break-words text-muted-foreground">{hotel.name}</p>)}{minimum !== null && <p className="pt-1 text-base font-bold">{p && p.hotels.length > 1 ? "A partir de " : ""}{brl(minimum)}</p>}</div>
              <div className="mt-4 space-y-2 border-t border-border pt-3 text-[11px] text-muted-foreground"><p className="flex items-start gap-2"><UserRound className="h-3.5 w-3.5 shrink-0" /><span className="break-all">{row.seller_name}</span></p><p>Criada em {dateTime(row.created_at)}</p>{row.sent_at && <p>Enviada em {dateTime(row.sent_at)}</p>}</div>
              <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><a href={`/p/${row.code}`} target="_blank" rel="noreferrer"><ExternalLink />Abrir</a></Button><Button variant="ghost" size="sm" asChild><Link to="/pacotes" search={{ code: row.code }}><Pencil />Editar</Link></Button></div>
              <div className="mt-3 flex flex-wrap gap-2">{row.status === "created" && <Button size="sm" className="w-full" onClick={() => request(row.code, "awaiting")}><Send />Enviar proposta</Button>}{row.status === "awaiting" && <Button size="sm" variant="secondary" onClick={() => request(row.code, "approved")}><CheckCircle2 />Aprovar</Button>}{row.status !== "cancelled" && row.status !== "approved" && <Button size="sm" variant="ghost" onClick={() => request(row.code, "cancelled")}><XCircle />Cancelar</Button>}{["approved", "cancelled"].includes(row.status) && <Button size="sm" variant="ghost" onClick={() => request(row.code, "created")}>Reabrir</Button>}</div>
            </article>; })}{!cards.length && <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground"><column.icon className="h-6 w-6" /><span>{q ? "Nenhum resultado" : "Nenhuma proposta"}</span></div>}</div>
          </section>;})}
        </div>
        <Dialog open={!!pending} onOpenChange={open => { if (!open && !mutation.isPending) setPending(null); }}><DialogContent><DialogHeader><DialogTitle>{pending?.status === "awaiting" ? "Enviar proposta" : pending?.status === "approved" ? "Confirmar aprovação" : pending?.status === "cancelled" ? "Cancelar proposta" : "Reabrir proposta"}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{pending?.client}</p>{pending?.status === "awaiting" && <div className="space-y-3"><Button variant="outline" className="w-full" onClick={() => { if (!pending) return; let phone = (pending.phone ?? "").replace(/\D/g, ""); if (phone.length === 10 || phone.length === 11) phone = `55${phone}`; const text = encodeURIComponent(shareMessage); window.open(`https://wa.me/${phone}?text=${text}`, "_blank", "noopener,noreferrer"); }}><Send />Abrir no WhatsApp</Button><Button variant="ghost" className="w-full" disabled={!shareMessage} onClick={async () => { try { await navigator.clipboard.writeText(shareMessage); setCopyState("copied"); } catch { setCopyState("error"); } }}>{copyState === "copied" ? "Mensagem copiada!" : "Copiar link"}</Button>{copyState !== "idle" && <p role="status" className="text-sm text-muted-foreground">{copyState === "copied" ? "Texto e link copiados." : "Não foi possível copiar. Tente novamente ou abra no WhatsApp."}</p>}<p className="text-sm text-muted-foreground">O envio já foi realizado?</p></div>}{mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}<DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={() => setPending(null)}>Voltar</Button><Button disabled={mutation.isPending || !pending} onClick={() => { if (pending) mutation.mutate({ data: { code: pending.code, status: pending.status } }); }}>{mutation.isPending && <Loader2 className="animate-spin" />}{pending?.status === "awaiting" ? "Confirmar envio" : "Confirmar"}</Button></DialogFooter></DialogContent></Dialog>
      </main>
    </div>
  );
}
