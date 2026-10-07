import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Star, Calendar, Users, Moon, Building2, Sparkles, ArrowRight, MessageCircle, Coffee, Check, Plane, PlusCircle } from "lucide-react";
import { AGENCY_WHATSAPP, brl, decodeProposal, nightsBetween, type Hotel } from "@/lib/hotels";
import logoAsset from "@/assets/excursao-brasilia.png.asset.json";
import { HotelGallery, HotelPhoto } from "@/components/HotelGallery";

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

const TABS = ["Hospedagem", "Aéreo", "Adicionais"] as const;

function Proposta() {
  const { t } = Route.useSearch();
  const p = decodeProposal(t);
  const [active, setActive] = useState<Hotel | null>(null);
  const [tab, setTab] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);

  if (!p) {
    return (
      <div className="proposta grid min-h-screen place-items-center bg-[var(--fundo)] text-[var(--texto-suave)]">
        <div className="rounded-2xl border border-[var(--borda)] bg-[var(--branco)] p-8 text-center shadow-lg">
          <Building2 className="mx-auto mb-3 h-12 w-12 text-[var(--azul)]/60" />
          <h2 className="text-xl font-semibold text-[var(--marinho)]">Proposta inválida ou expirada</h2>
          <p className="mt-1 text-sm">Verifique o link recebido com o seu agente.</p>
        </div>
      </div>
    );
  }

  const nights = nightsBetween(p.s.checkin, p.s.checkout);
  const fmt = (d: string) => new Date(d + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const hotels = p.hotels as Hotel[];
  const cliente = p.s.cliente?.trim();
  const destino = p.s.destino.split(",")[0];
  const hero = hotels.find((h) => h.image)?.image;
  const pick = chosen != null ? hotels[chosen] : null;
  const wa = `https://wa.me/${AGENCY_WHATSAPP}?text=${encodeURIComponent(
    `Olá! Vi minha proposta para ${destino}${pick ? ` e escolhi o ${pick.name} (${brl(pick.total)})` : ""}.`,
  )}`;

  return (
    <div className="proposta min-h-screen pb-32">
      <header className="cabecalho sticky top-0 z-30">
        <img src={logoAsset.url} alt="Excursão Brasília" className="logo" />
        <a href={wa} target="_blank" rel="noreferrer" className="botao botao-secundario text-sm">
          <MessageCircle className="h-4 w-4" /> Fale conosco
        </a>
      </header>

      <section
        className="hero relative overflow-hidden"
        style={hero ? ({ "--foto-destino": `url('${hero}')` } as React.CSSProperties) : undefined}
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="hero-sobretitulo">SUA PRÓXIMA VIAGEM</div>
          <h1 className="hero-titulo flex flex-wrap items-center gap-x-3">
            {p.s.origem && <span>{p.s.origem}</span>}
            {p.s.origem && <ArrowRight className="hero-seta h-8 w-8 md:h-12 md:w-12 inline" />}
            <span>{destino}</span>
          </h1>
          <p className="hero-subtitulo font-medium">Uma viagem especial para você{cliente ? `, ${cliente}` : ""}</p>
          <div className="viagem-infos">
            {
              [
                [Calendar, `${fmt(p.s.checkin)} a ${fmt(p.s.checkout)}`],
                [Moon, `${nights} ${nights === 1 ? "noite" : "noites"}`],
                [Users, p.s.hospedes],
              ].map(([I, txt], k) => {
                const Icon = I as typeof Calendar;
                return (
                  <span key={k} className="viagem-chip text-sm">
                    <Icon className="h-4 w-4" />
                    {txt as string}
                  </span>
                );
              })
            }
          </div>
        </div>
      </section>

      {cliente && (
        <div className="cliente-faixa max-w-[1200px] mx-auto">
          Proposta exclusiva para <span className="cliente-nome">{cliente}</span>
        </div>
      )}

      <nav className="etapas max-w-[1200px] mx-auto mt-4 border-b border-[var(--borda)]">
        {TABS.map((n, k) => (
          <button
            key={n}
            onClick={() => setTab(k)}
            aria-selected={tab === k}
            className="etapa"
          >
            <span className="etapa-numero text-sm font-bold">{k + 1}</span>
            <span>{n}</span>
          </button>
        ))}
      </nav>

      <main className="conteudo">
        {tab === 0 && (
          <>
            <h2 className="secao-titulo">Escolha sua hospedagem</h2>
            <p className="secao-descricao text-sm">Toque no hotel para ver fotos e detalhes.</p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {hotels.map((h, i) => {
                const [room, meal] = (h.room ?? "").split(" · ");
                const sel = chosen === i;
                return (
                  <article key={i} className={`hotel-card flex flex-col ${sel ? "is-selected" : ""}`}>
                    <button onClick={() => setActive(h)} className="hotel-foto-container block w-full text-left relative overflow-hidden">
                      <div className="[&_img]:w-full [&_img]:aspect-[1.65] [&_img]:object-cover [&_img]:rounded-[18px]">
                        <HotelPhoto hotel={h} />
                      </div>
                      {meal && (
                        <span className="hotel-alimentacao flex items-center gap-1.5 text-xs shadow">
                          <Coffee className="h-3.5 w-3.5" />
                          {meal}
                        </span>
                      )}
                      {sel && (
                        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-[var(--azul)] px-3 py-1 text-xs font-semibold text-[var(--branco)]">
                          <Check className="h-3.5 w-3.5" /> Selecionado
                        </span>
                      )}
                    </button>
                    <div className="hotel-corpo flex flex-1 flex-col">
                      <h3 className="hotel-nome">{h.name}</h3>
                      <div className="hotel-localizacao flex items-center gap-1.5 text-sm">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">{h.address || destino}</span>
                        <a
                          href={`https://www.google.com/maps/search/${encodeURIComponent(`${h.name} ${h.address}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hotel-link text-xs ml-auto shrink-0"
                        >
                          Ver no mapa
                        </a>
                      </div>
                      {h.stars > 0 && (
                        <div className="hotel-estrelas mt-2 flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, k) => (
                            <Star
                              key={k}
                              className={`h-4 w-4 ${k < h.stars ? "fill-[var(--estrela)] text-[var(--estrela)]" : "text-[var(--texto-suave)]/30"}`}
                            />
                          ))}
                        </div>
                      )}
                      {room && <div className="mt-2 text-xs text-[var(--texto-suave)]">{room}</div>}
                      <div className="hotel-comodidades mt-auto pt-3">
                        <div className="text-xs text-[var(--texto-suave)]">
                          {brl(h.nightly)} / noite · {nights} {nights === 1 ? "noite" : "noites"}
                        </div>
                        <div className="text-2xl font-black text-[var(--marinho)]">{brl(h.total)}</div>
                      </div>
                      <div className="space-y-2 pt-2">
                        <button
                          onClick={() => setActive(h)}
                          className="botao botao-secundario w-full text-sm"
                        >
                          Ver fotos e detalhes <ArrowRight className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setChosen(sel ? null : i)}
                          className="botao botao-primario w-full text-sm"
                        >
                          {sel ? (
                            <>
                              <Check className="h-4 w-4" /> Hospedagem selecionada
                            </>
                          ) : (
                            <>
                              Selecionar hospedagem <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {tab > 0 && (
          <div className="mt-10 rounded-[24px] border border-[var(--borda)] bg-[var(--branco)] p-10 text-center shadow-md">
            {tab === 1 ? <Plane className="mx-auto h-10 w-10 text-[var(--azul)]" /> : <PlusCircle className="mx-auto h-10 w-10 text-[var(--azul)]" />}
            <h2 className="secao-titulo mt-3 text-xl">{TABS[tab]}</h2>
            <p className="secao-descricao text-sm mt-1">
              Fale com a gente para incluir {tab === 1 ? "passagens aéreas" : "passeios, transfer e seguro"} na sua viagem.
            </p>
            <a href={wa} target="_blank" rel="noreferrer" className="botao botao-primario mt-4 text-sm">
              <MessageCircle className="h-4 w-4" /> Fale conosco
            </a>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-[var(--texto-suave)]">
          Valores sujeitos à disponibilidade no momento da confirmação.
        </p>
      </main>

      {pick && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--borda)] bg-[var(--branco)] shadow-2xl p-4">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-xs text-[var(--texto-suave)]">{pick.name}</div>
              <div className="text-xl font-black text-[var(--marinho)]">{brl(pick.total)}</div>
            </div>
            <a href={wa} target="_blank" rel="noreferrer" className="botao botao-primario text-sm">
              <MessageCircle className="h-4 w-4" /> Confirmar no WhatsApp
            </a>
          </div>
        </div>
      )}

      {active && <HotelGallery hotel={active} onClose={() => setActive(null)} />}
    </div>
  );
}
