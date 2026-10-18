import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Star, Calendar, Users, Moon, Building2, Sparkles, ArrowRight, MessageCircle, Coffee, Check, Plane, PlusCircle } from "lucide-react";
import { AGENCY_WHATSAPP, brl, decodeProposal, hasBreakfast, nightsBetween, type Hotel } from "@/lib/hotels";
import logoAsset from "@/assets/excursao-brasilia.png.asset.json";
import { HotelGallery, HotelPhoto } from "@/components/HotelGallery";
import { TransportPanel, TransportItinerary } from "@/components/TransportPanel";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgencyContact } from "@/lib/settings.functions";
import { proposalPreviewMeta } from "@/lib/proposal-preview";
import { customerProposal } from "@/lib/customer-proposal";
import { acceptProposalPackage } from "@/lib/proposals.functions";

export const Route = createFileRoute("/proposta")({
  validateSearch: (s: Record<string, unknown>) => ({ t: String(s["t"] ?? "") }),
  head: () => ({
    meta: [
      { title: "Sua proposta de viagem — Excursão Brasília" },
      { name: "description", content: "Confira as opções de hospedagem selecionadas especialmente para você." },
      { property: "og:title", content: "Sua proposta de viagem — Excursão Brasília" },
      { property: "og:description", content: "Opções de hotéis selecionadas pela Excursão Brasília." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...proposalPreviewMeta,
    ],
  }),
  component: Proposta,
});

const TABS = ["Hospedagem", "Transporte", "Adicionais"] as const;

function Proposta() {
  const { t } = Route.useSearch();
  const internal = decodeProposal(t);
  const p = internal ? customerProposal(internal) : null;
  return <ProposalView p={p} />;
}

export function ProposalView({ p, code, acceptance }: { p: ReturnType<typeof decodeProposal>; code?: string; acceptance?: { hotelIndex: number; acceptedAt: string; total: number } | null | undefined }) {
  const contact = useServerFn(getAgencyContact);
  const agency = useQuery({ queryKey: ["agency-contact"], queryFn: async () => {
    try {
      return await contact();
    } catch {
      return null;
    }
  }, staleTime: 60000 });
  const acceptPackage = useServerFn(acceptProposalPackage);
  const [active, setActive] = useState<Hotel | null>(null);
  const [tab, setTab] = useState(0);
  const [chosen, setChosen] = useState<number | null>(acceptance?.hotelIndex ?? null);
  const [aiFailed, setAiFailed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const isConfirmed = confirmed || !!acceptance;

  if (!p) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 text-muted-foreground">
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-md">
          <Building2 className="mx-auto mb-3 h-12 w-12 text-primary/60" />
          <h2 className="text-xl font-semibold text-foreground">Proposta inválida ou expirada</h2>
          <p className="mt-1 text-sm">Verifique o link recebido com o seu agente.</p>
        </div>
      </div>
    );
  }

  const nights = nightsBetween(p.s.checkin, p.s.checkout);
  const fmt = (d: string) => new Date(d + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const hotels = p.hotels as Hotel[];
  const pricedHotels = hotels
    .map((hotel, originalIndex) => ({ hotel, originalIndex }))
    .sort((a, b) => a.hotel.total - b.hotel.total || a.originalIndex - b.originalIndex);
  const shortCity = (name: string) => (name.split(",")[0] ?? "").replace(/\s*\([A-Z]{3}\)\s*/gi, "").trim();
  const destino = shortCity(p.s.destino ?? "");
  const cliente = p.s.cliente?.trim();
  const hero = hotels.find((h) => h.image)?.image;
  const destSlug = destino.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const aiHero = `/api/public/destination-image/${destSlug}`;
  const hasTransport = !!p.s.transport && p.s.transport.mode !== "none";
  const chosenIndex = acceptance?.hotelIndex ?? chosen;
  const pick = chosenIndex != null ? hotels[chosenIndex] : null;
  const handleConfirmPackage = async () => {
    if (!pick || chosenIndex === null || confirming || isConfirmed) return;
    if (!code) { setConfirmError("Solicite à agência o link atualizado para confirmar este pacote."); return; }
    setConfirming(true); setConfirmError("");
    try { await acceptPackage({ data: { code, hotelIndex: chosenIndex, total: pick.total } }); setConfirmed(true); }
    catch (e) { setConfirmError(e instanceof Error ? e.message : "Não foi possível confirmar. Tente novamente."); }
    finally { setConfirming(false); }
  };

  const waText = `Olá! Vi minha proposta para ${destino}${pick ? ` e confirmei o pacote ${pick.name} (${brl(pick.total)}${hasTransport ? ", com passagem" : ""})` : ""}.`;
  const wa = `https://wa.me/${agency.data?.whatsapp ?? AGENCY_WHATSAPP}?text=${encodeURIComponent(waText)}`;

  return (
    <div className="proposta min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-background pb-40 text-foreground sm:pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3">
          <img src={logoAsset.url} alt="Excursão Brasília" className="h-9 w-auto object-contain sm:h-12" />
          <a href={wa} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-primary px-3 py-2 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground sm:gap-2 sm:px-4 sm:text-sm">
            <MessageCircle className="h-4 w-4" /> Fale conosco
          </a>
        </div>
      </header>

      <section className="relative overflow-hidden bg-navy">
        {!aiFailed ? (
          <img src={aiHero} alt="" onError={() => setAiFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          hero && <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/60 to-navy/10" />
        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-6 text-card sm:px-5 sm:pb-16 sm:pt-10 md:pb-24 md:pt-16">
          <h1 className="text-3xl font-extrabold leading-tight break-words sm:mt-2 sm:text-4xl md:text-6xl">
            <span>{destino}</span>
          </h1>
          <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-5 sm:gap-2">
            {[
              [Calendar, `${fmt(p.s.checkin)} a ${fmt(p.s.checkout)}`],
              [Moon, `${nights} ${nights === 1 ? "noite" : "noites"}`],
              [Users, p.s.hospedes],
            ].map(([I, txt], k) => {
              const Icon = I as typeof Calendar;
              return <span key={k} className="flex items-center gap-1.5 rounded-full border border-card/40 bg-card/15 px-3 py-1.5 text-xs backdrop-blur sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"><Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{txt as string}</span>;
            })}
          </div>
          {cliente && (
            <div className="mt-4 flex max-w-full items-start gap-2 border-l-2 border-turquoise pl-3 sm:mt-6 sm:gap-3 sm:pl-4">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-turquoise sm:mt-1 sm:h-5 sm:w-5" aria-hidden="true" />
              <p className="min-w-0 text-sm leading-relaxed sm:text-base md:text-lg">
                Proposta exclusiva para <span className="font-bold break-words">{cliente}</span>
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-6xl px-3 sm:px-4">
        <nav className="sticky top-[57px] z-20 mt-2 grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:static sm:mt-4 sm:rounded-t-2xl sm:border-x-0 sm:border-t-0 sm:shadow-none">
          {TABS.map((n, k) => (
            <Button variant="ghost" key={n} onClick={() => setTab(k)} className={`h-auto min-w-0 gap-1 rounded-none whitespace-normal border-b-[3px] px-0.5 py-2 text-xs font-semibold transition sm:gap-2 sm:px-1 sm:py-3 sm:text-sm ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs sm:h-8 sm:w-8 ${tab === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{k + 1}</span>{n}
            </Button>
          ))}
        </nav>

        {tab === 0 && (
          <>
            {p.s.transport && hasTransport && <div className="mt-5 sm:mt-8"><h2 className="mb-2 text-xl font-extrabold text-navy sm:mb-3 sm:text-2xl md:text-3xl">{p.s.transport.mode === "bus" ? "Seu ônibus" : "Seu voo"}</h2><TransportItinerary s={p.s} value={p.s.transport} /></div>}
            <h2 className="mt-6 text-xl font-extrabold text-navy sm:mt-8 sm:text-2xl md:text-3xl">Selecione o seu pacote</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">Toque no hotel para ver fotos e detalhes.{hasTransport && " Os valores já incluem a passagem."}</p>
            <div className="mt-3 grid gap-3 sm:mt-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pricedHotels.map(({ hotel: h, originalIndex: i }) => {
                const [room, meal] = (h.room ?? "").split(" · ");
                const sel = chosenIndex === i;
                const included = [
                  hasTransport ? (p.s.transport?.mode === "bus" ? "Passagem de ônibus (ida e volta)" : "Passagem aérea (ida e volta)") : null,
                  `Hospedagem · ${nights} ${nights === 1 ? "noite" : "noites"}`,
                  h.provider !== "airbnb" && hasBreakfast(meal) ? `Café da manhã${meal ? ` (${meal})` : ""}` : null,
                  ...(h.extras ?? p.s.extras ?? []).map(item => item.name.trim()),
                ].filter(Boolean) as string[];
                return (
                  <article key={i} className={`flex min-w-0 flex-col rounded-2xl bg-card p-2 shadow-sm transition sm:rounded-3xl sm:p-3 ${sel ? "ring-[3px] ring-primary" : "ring-1 ring-border"}`}>
                    <button onClick={() => setActive(h)} className="relative block overflow-hidden rounded-xl sm:rounded-2xl [&_img]:!h-40 [&_img]:!w-full [&_img]:!object-cover sm:[&_img]:!h-56 [&>div]:!h-40 [&>div]:!w-full sm:[&>div]:!h-56">
                      <HotelPhoto hotel={h} />
                      {meal && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-card px-2 py-1 text-[11px] font-semibold shadow sm:left-3 sm:top-3 sm:gap-1.5 sm:px-3 sm:text-xs">{h.provider !== "airbnb" && hasBreakfast(meal) && <Coffee className="h-3.5 w-3.5" />}{meal}</span>}
                      {sel && <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground sm:right-3 sm:top-3 sm:px-3 sm:text-xs"><Check className="h-3.5 w-3.5" />Pacote selecionado</span>}
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col px-1 pt-2 sm:px-2 sm:pt-3">
                      <h3 className="text-base font-extrabold leading-tight text-navy sm:text-lg">{h.name}</h3>
                      {h.provider === "airbnb" && <span className="mt-1 inline-flex w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Airbnb</span>}
                      <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground sm:gap-1.5 sm:text-sm">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" /><span className="min-w-0 flex-1 truncate">{h.address || destino}</span>
                        <a href={`https://www.google.com/maps/search/${encodeURIComponent(`${h.name} ${h.address}`)}`} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-primary">· Ver mapa</a>
                      </div>
                      {h.provider === "airbnb" && typeof h.rating === "number" && h.rating >= 0 && h.rating <= 5 &&
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs sm:mt-2">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                          <strong>{h.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</strong>
                          {typeof h.reviewCount === "number" && h.reviewCount > 0 &&
                            <span className="text-muted-foreground">({h.reviewCount.toLocaleString("pt-BR")} avaliações)</span>}
                        </div>}
                      {h.provider !== "airbnb" && h.stars > 0 && <div className="mt-1.5 flex gap-0.5 sm:mt-2">{Array.from({ length: 5 }).map((_, k) => <Star key={k} className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${k < h.stars ? "fill-star text-star" : "text-muted-foreground/40"}`} />)}</div>}
                      {room && <div className="mt-1.5 text-[11px] text-muted-foreground sm:mt-2 sm:text-xs">{room}</div>}
                      <ul className="mt-2 space-y-0.5 text-xs leading-relaxed sm:mt-3 sm:space-y-1 sm:text-sm">
                        <li className="text-[11px] font-semibold text-muted-foreground sm:text-xs">O que está incluso</li>
                        {included.map((x) => <li key={x} className="flex items-start gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" />{x}</li>)}
                      </ul>
                      <div className="mt-2 border-t border-border pt-2 sm:mt-3 sm:pt-3">
                        <div className="text-[11px] text-muted-foreground sm:text-xs">Pacote completo · {p.s.hospedes}</div>
                        <div className="text-xl font-black sm:text-2xl">{brl(h.total)}</div>
                      </div>
                      <div className="mt-auto grid grid-cols-2 gap-2 pt-2 sm:block sm:space-y-2 sm:pt-3">
                        <button onClick={() => setActive(h)} className="flex min-h-10 w-full items-center justify-center gap-1 rounded-xl border-2 border-primary px-2 py-2 text-center text-xs font-semibold text-primary sm:gap-2 sm:py-2.5 sm:text-sm">Ver detalhes <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
                        <Button disabled={isConfirmed || confirming} onClick={() => { setChosen(sel ? null : i); setConfirmError(""); }} className="h-auto min-h-10 w-full rounded-xl px-2 py-2 text-xs sm:py-2.5 sm:text-sm">{sel ? <><Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{isConfirmed ? "Confirmado" : "Selecionado"}</> : <>Selecionar <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></>}</Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
        {tab === 1 && p.s.transport && p.s.transport.mode !== "none" && <div className="mx-auto mt-5 max-w-3xl sm:mt-8"><TransportPanel s={p.s} value={p.s.transport} /></div>}
        {(tab === 2 || (tab === 1 && (!p.s.transport || p.s.transport.mode === "none"))) && (
          <div className="mt-6 rounded-2xl bg-card p-6 text-center shadow-md sm:mt-10 sm:rounded-3xl sm:p-10">
            {tab === 1 ? <Plane className="mx-auto h-10 w-10 text-primary" /> : <PlusCircle className="mx-auto h-10 w-10 text-primary" />}
            <h2 className="mt-3 text-xl font-bold">{TABS[tab]}</h2>
            {tab === 2 && pick?.extras?.length ? <ul className="mt-4 space-y-2 text-sm">{pick.extras.map((item, i) => <li key={i} className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-primary" />{item.name}</li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">{tab === 1 ? "Sem transporte incluído nesta proposta." : pick ? "Este pacote não possui serviços adicionais." : "Selecione um pacote para ver os serviços adicionais incluídos."}</p>}
            <a href={wa} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"><MessageCircle className="h-4 w-4" />Fale conosco</a>
          </div>
        )}
        <p className="mt-8 text-center text-[11px] text-muted-foreground sm:mt-10 sm:text-xs">Valores sujeitos à disponibilidade no momento da confirmação.</p>
      </div>

      {pick && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/98 shadow-2xl backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-2 pb-[max(.5rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3">
            <div className="min-w-0"><div className="truncate text-[11px] text-muted-foreground sm:text-xs">{pick.name}</div><div className="text-lg font-black sm:text-xl">{brl(acceptance?.total ?? pick.total)}</div>{confirmError && <p role="alert" className="text-[11px] text-destructive sm:text-xs">{confirmError}</p>}</div>
            <div className="grid grid-cols-[minmax(0,1fr)_42px] gap-2 sm:flex sm:items-center">
              <Button disabled={confirming || isConfirmed} onClick={handleConfirmPackage} className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground sm:shrink-0 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm">
                <Check className="h-4 w-4" /> {confirming ? "Confirmando…" : isConfirmed ? "Pacote confirmado!" : "Confirmar pacote"}
              </Button>
              <a href={wa} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp" className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-primary text-primary hover:bg-primary/10 sm:h-auto sm:w-auto sm:shrink-0 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm sm:font-semibold">
                <MessageCircle className="h-4 w-4" /><span className="hidden sm:inline">WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {active && <HotelGallery hotel={active} stay={{ checkin: p.s.checkin, checkout: p.s.checkout, adults: p.s.adults ?? 2 }} allowRemoteDetails={false} onClose={() => setActive(null)} />}
    </div>
  );
}