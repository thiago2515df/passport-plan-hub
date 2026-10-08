import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Star, Calendar, Users, Moon, Building2, Sparkles, ArrowRight, MessageCircle, Coffee, Check, Plane, PlusCircle } from "lucide-react";
import { AGENCY_WHATSAPP, brl, decodeProposal, hasBreakfast, nightsBetween, packageTotal, type Hotel } from "@/lib/hotels";
import logoAsset from "@/assets/excursao-brasilia.png.asset.json";
import { HotelGallery, HotelPhoto } from "@/components/HotelGallery";
import { TransportPanel, TransportItinerary } from "@/components/TransportPanel";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgencyContact } from "@/lib/settings.functions";

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
    ],
  }),
  component: Proposta,
});

const TABS = ["Hospedagem", "Transporte", "Adicionais"] as const;

function Proposta() {
  const { t } = Route.useSearch();
  const p = decodeProposal(t);
  return <ProposalView p={p} />;
}

export function ProposalView({ p }: { p: ReturnType<typeof decodeProposal> }) {
  const contact = useServerFn(getAgencyContact);
  const agency = useQuery({ queryKey: ["agency-contact"], queryFn: () => contact(), staleTime: 60000 });
  const [active, setActive] = useState<Hotel | null>(null);
  const [tab, setTab] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [aiFailed, setAiFailed] = useState(false);

  if (!p) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
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
  const shortCity = (name: string) => (name.split(",")[0] ?? "").replace(/\s*\([A-Z]{3}\)\s*/gi, "").trim();
  const origem = shortCity(p.s.origem ?? "");
  const destino = shortCity(p.s.destino ?? "");
  const hero = hotels.find((h) => h.image)?.image;
  const destSlug = destino.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const aiHero = `/api/public/destination-image/${destSlug}`;
  const hasTransport = !!p.s.transport && p.s.transport.mode !== "none";
  const pick = chosen != null ? hotels[chosen] : null;
  const wa = `https://wa.me/${agency.data?.whatsapp ?? AGENCY_WHATSAPP}?text=${encodeURIComponent(
    `Olá! Vi minha proposta para ${destino}${pick ? ` e escolhi o ${pick.name} (${brl(packageTotal(pick.total, p.s.transport))}${hasTransport ? ", com passagem" : ""})` : ""}.`,
  )}`;

  return (
    <div className="proposta min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <img src={logoAsset.url} alt="Excursão Brasília" className="h-12 w-auto object-contain" />
          <a href={wa} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-2 rounded-xl border-2 border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground">
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
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-10 text-card md:pb-24 md:pt-16">
          <h1 className="mt-2 flex flex-wrap items-center gap-x-3 text-4xl font-extrabold tracking-tight md:text-6xl">
            {origem && <><span>{origem}</span><ArrowRight className="h-8 w-8 text-turquoise md:h-12 md:w-12" strokeWidth={3} /></>}
            <span>{destino}</span>
          </h1>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              [Calendar, `${fmt(p.s.checkin)} a ${fmt(p.s.checkout)}`],
              [Moon, `${nights} ${nights === 1 ? "noite" : "noites"}`],
              [Users, p.s.hospedes],
            ].map(([I, txt], k) => {
              const Icon = I as typeof Calendar;
              return <span key={k} className="flex items-center gap-2 rounded-full border border-card/40 bg-card/15 px-4 py-2 text-sm backdrop-blur"><Icon className="h-4 w-4" />{txt as string}</span>;
            })}
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto max-w-6xl px-4">

        <nav className="mt-4 grid grid-cols-3 rounded-t-2xl border-b border-border bg-card">
          {TABS.map((n, k) => (
            <Button variant="ghost" key={n} onClick={() => setTab(k)} className={`h-auto rounded-none whitespace-normal border-b-[3px] px-1 py-3 text-sm font-semibold transition ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              <span className={`grid h-8 w-8 place-items-center rounded-full ${tab === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{k + 1}</span>{n}
            </Button>
          ))}
        </nav>

        {tab === 0 && (
          <>
            {hasTransport && <div className="mt-8"><h2 className="mb-3 text-2xl font-extrabold text-navy md:text-3xl">{p.s.transport!.mode === "bus" ? "Seu ônibus" : "Seu voo"}</h2><TransportItinerary s={p.s} value={p.s.transport!} /></div>}
            <h2 className="mt-8 text-2xl font-extrabold text-navy md:text-3xl">Escolha sua hospedagem</h2>
            <p className="text-sm text-muted-foreground">Toque no hotel para ver fotos e detalhes.{hasTransport && " Os valores já incluem a passagem."}</p>
            <div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {hotels.map((h, i) => {
                const [room, meal] = (h.room ?? "").split(" · ");
                const sel = chosen === i;
                const included = [hasTransport ? (p.s.transport!.mode === "bus" ? "Passagem de ônibus (ida e volta)" : "Passagem aérea (ida e volta)") : null, `Hotel · ${nights} ${nights === 1 ? "noite" : "noites"}`, hasBreakfast(meal) ? `Com café da manhã${meal ? ` (${meal})` : ""}` : "Sem café da manhã"].filter(Boolean) as string[];
                return (
                  <article key={i} className={`flex flex-col rounded-3xl bg-card p-3 shadow-sm transition ${sel ? "ring-[3px] ring-primary" : "ring-1 ring-border"}`}>
                    <button onClick={() => setActive(h)} className="relative block overflow-hidden rounded-2xl [&_img]:!h-56 [&_img]:!w-full [&>div]:!h-56 [&>div]:!w-full">
                      <HotelPhoto hotel={h} />
                      {meal && <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-semibold shadow"><Coffee className="h-3.5 w-3.5" />{meal}</span>}
                      {sel && <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"><Check className="h-3.5 w-3.5" />Selecionado</span>}
                    </button>
                    <div className="flex flex-1 flex-col px-2 pt-3">
                      <h3 className="text-lg font-extrabold leading-tight text-navy">{h.name}</h3>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{h.address || destino}</span>
                        <a href={`https://www.google.com/maps/search/${encodeURIComponent(`${h.name} ${h.address}`)}`} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-primary">· Ver no mapa</a>
                      </div>
                      {h.stars > 0 && <div className="mt-2 flex gap-0.5">{Array.from({ length: 5 }).map((_, k) => <Star key={k} className={`h-4 w-4 ${k < h.stars ? "fill-star text-star" : "text-muted-foreground/40"}`} />)}</div>}
                      {room && <div className="mt-2 text-xs text-muted-foreground">{room}</div>}
                      <ul className="mt-3 space-y-1 text-sm">
                        <li className="text-xs font-semibold text-muted-foreground">O que está incluso</li>
                        {included.map((x) => <li key={x} className="flex items-start gap-1.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{x}</li>)}
                      </ul>
                      <div className="mt-3 border-t border-border pt-3">
                        <div className="text-xs text-muted-foreground">{hasTransport ? `Pacote completo · ${p.s.hospedes}` : `${brl(h.nightly)} / noite · ${nights} ${nights === 1 ? "noite" : "noites"}`}</div>
                        <div className="text-2xl font-black">{brl(packageTotal(h.total, p.s.transport))}</div>
                      </div>
                      <div className="mt-auto space-y-2 pt-3">
                        <button onClick={() => setActive(h)} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary py-2.5 text-sm font-semibold text-primary">Ver fotos e detalhes <ArrowRight className="h-4 w-4" /></button>
                        <button onClick={() => setChosen(sel ? null : i)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">{sel ? <><Check className="h-4 w-4" />Hospedagem selecionada</> : <>Selecionar hospedagem <ArrowRight className="h-4 w-4" /></>}</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
        {tab === 1 && p.s.transport && p.s.transport.mode !== "none" && <div className="mx-auto mt-8 max-w-3xl"><TransportPanel s={p.s} value={p.s.transport} /></div>}
        {(tab === 2 || (tab === 1 && (!p.s.transport || p.s.transport.mode === "none"))) && (
          <div className="mt-10 rounded-3xl bg-card p-10 text-center shadow-md">
            {tab === 1 ? <Plane className="mx-auto h-10 w-10 text-primary" /> : <PlusCircle className="mx-auto h-10 w-10 text-primary" />}
            <h2 className="mt-3 text-xl font-bold">{TABS[tab]}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{tab === 1 ? "Sem transporte incluído nesta proposta." : "Fale com a gente para incluir passeios, transfer e seguro na sua viagem."}</p>
            <a href={wa} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"><MessageCircle className="h-4 w-4" />Fale conosco</a>
          </div>
        )}
        <p className="mt-10 text-center text-xs text-muted-foreground">Valores sujeitos à disponibilidade no momento da confirmação.</p>
      </div>

      {pick && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card shadow-2xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0"><div className="truncate text-xs text-muted-foreground">{pick.name}</div><div className="text-xl font-black">{brl(packageTotal(pick.total, p.s.transport))}</div></div>
            <a href={wa} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"><MessageCircle className="h-4 w-4" />Confirmar no WhatsApp</a>
          </div>
        </div>
      )}

      {active && <HotelGallery hotel={active} onClose={() => setActive(null)} />}
    </div>
  );
}
