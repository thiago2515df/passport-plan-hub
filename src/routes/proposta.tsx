import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Star, Calendar, Users, Building2, CheckCircle2, Sparkles, ChevronRight } from "lucide-react";
import { brl, decodeProposal, nightsBetween, type Hotel } from "@/lib/hotels";
import logoAsset from "@/assets/excursao-brasilia.png.asset.json";
import { HotelGallery, HotelPhoto } from "@/components/HotelGallery";

export const Route = createFileRoute("/proposta")({
  validateSearch: (s: Record<string, unknown>) => ({ t: String(s["t"] ?? "") }),
  head: () => ({
    meta: [
      { title: "Sua proposta de hospedagem — PassHub" },
      { name: "description", content: "Confira as opções de hotéis selecionadas especialmente para você." },
      { property: "og:title", content: "Sua proposta de hospedagem" },
      { property: "og:description", content: "Opções de hotéis selecionadas pelo seu agente de viagens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Proposta,
});

function Proposta() {
  const { t } = Route.useSearch();
  const p = decodeProposal(t);
  const [activeHotel, setActiveHotel] = useState<Hotel | null>(null);

  if (!p) {
    return (
      <div className="grid min-h-screen place-items-center bg-background font-sans text-muted-foreground">
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <Building2 className="mx-auto mb-3 h-12 w-12 text-primary/60" />
          <h2 className="text-xl font-semibold text-foreground">Proposta inválida ou expirada</h2>
          <p className="mt-1 text-sm">Verifique o link recebido com o seu agente.</p>
        </div>
      </div>
    );
  }

  const nights = nightsBetween(p.s.checkin, p.s.checkout);
  const fmt = (d: string) => new Date(d + "T12:00").toLocaleDateString("pt-BR");
  const hotels = p.hotels as Hotel[];

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 via-background to-background px-4 py-12 font-sans text-foreground">
      <div className="mx-auto max-w-4xl">
        {/* Header topo */}
        <div className="flex flex-col items-center sm:flex-row sm:justify-between border-b border-border/60 pb-6 mb-8 gap-4">
          <img src={logoAsset.url} alt="Excursão Brasília" className="w-36 object-contain" />
          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Proposta Exclusiva de Hospedagem
          </div>
        </div>

        {/* Título e Resumo da Viagem */}
        <div className="rounded-3xl border border-border/80 bg-card p-6 md:p-8 shadow-xl shadow-black/[0.03]">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Sua proposta personalizada</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Selecionamos as melhores opções de estadia para a sua viagem. Clique em qualquer hotel para explorar fotos, comodidades e detalhes completos.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl bg-secondary/60 p-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card shadow-sm text-primary">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground font-medium">Destino</div>
                <div className="font-semibold truncate">{p.s.destino}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card shadow-sm text-primary">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground font-medium">Período ({nights} {nights === 1 ? "noite" : "noites"})</div>
                <div className="font-semibold">{fmt(p.s.checkin)} – {fmt(p.s.checkout)}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card shadow-sm text-primary">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground font-medium">Acompanhantes</div>
                <div className="font-semibold">{p.s.hospedes}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de hotéis da proposta */}
        <div className="mt-8 space-y-6">
          <h2 className="text-lg font-semibold px-1">Opções disponíveis para escolha ({hotels.length})</h2>
          
          {hotels.map((h, i) => (
            <div
              key={h.id ?? i}
              onClick={() => setActiveHotel(h)}
              className="group cursor-pointer overflow-hidden rounded-3xl border border-border/80 bg-card transition-all duration-300 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/5 md:flex"
            >
              {/* Foto com indicador de galeria */}
              <div className="relative md:w-72 shrink-0 overflow-hidden bg-secondary">
                {(() => {
                  const fallbackImg = "/uploads/1791395629883-0-Captura-de-Tela-29-.png";
                  const imgSrc = h.image && h.image.trim().length > 0 ? h.image : fallbackImg;
                  return (
                    <img
                      src={imgSrc}
                      alt={h.name}
                      loading="lazy"
                      className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105 md:h-full"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = fallbackImg;
                      }}
                    />
                  );
                })()}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 md:hidden" />
                <span className="absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold backdrop-blur shadow">
                  Ver fotos e detalhes
                </span>
              </div>

              {/* Conteúdo do hotel */}
              <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      OPÇÃO {i + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: h.stars || 3 }).map((_, k) => (
                        <Star key={k} className="h-4 w-4 fill-star text-star" />
                      ))}
                    </div>
                  </div>

                  <h3 className="mt-2.5 text-xl font-bold group-hover:text-primary transition-colors">
                    {h.name}
                  </h3>

                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{h.address}</span>
                  </div>

                  {h.room && (
                    <div className="mt-2 inline-block rounded-lg bg-secondary/80 px-3 py-1 text-xs font-medium text-secondary-foreground">
                      {h.room}
                    </div>
                  )}

                  {/* O que está incluso no pacote */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" /> Hospedagem confirmada
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" /> Taxas e impostos inclusos
                    </div>
                  </div>
                </div>

                {/* Preços e Ação */}
                <div className="mt-6 flex flex-col sm:flex-row sm:items-end justify-between border-t border-border/60 pt-4 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {brl(h.nightly)} / noite · {nights} {nights === 1 ? "noite" : "noites"}
                    </div>
                    <div className="text-2xl font-black text-foreground">
                      {brl(h.total)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm font-semibold text-primary group-hover:translate-x-1 transition-transform">
                    Ver detalhes completos <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Rodapé da proposta */}
        <div className="mt-12 text-center text-xs text-muted-foreground border-t border-border/60 pt-6">
          Proposta gerada com PassHub Propostas · Valores sujeitos à disponibilidade no momento da confirmação.
        </div>
      </div>

      {/* Modal de Galeria / Detalhes do Hotel */}
      {activeHotel && (
        <HotelGallery
          hotel={activeHotel}
          onClose={() => setActiveHotel(null)}
        />
      )}
    </div>
  );
}
