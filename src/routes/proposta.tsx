import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Star, Calendar, Users } from "lucide-react";
import { brl, decodeProposal, nightsBetween } from "@/lib/hotels";
import logoAsset from "@/assets/excursao-brasilia.png.asset.json";

export const Route = createFileRoute("/proposta")({
  validateSearch: (s: Record<string, unknown>) => ({ t: String(s["t"] ?? "") }),
  head: () => ({
    meta: [
      { title: "Sua proposta de hospedagem — PassHub" },
      { name: "description", content: "Confira as opções de hotéis selecionadas para você." },
      { property: "og:title", content: "Sua proposta de hospedagem" },
      { property: "og:description", content: "Opções de hotéis selecionadas pelo seu agente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Proposta,
});

function Proposta() {
  const { t } = Route.useSearch();
  const p = decodeProposal(t);
  if (!p) return <div className="grid min-h-screen place-items-center font-sans text-muted-foreground">Proposta inválida.</div>;
  const nights = nightsBetween(p.s.checkin, p.s.checkout);
  const fmt = (d: string) => new Date(d + "T12:00").toLocaleDateString("pt-BR");
  const hotels = p.hotels;

  return (
    <div className="min-h-screen bg-background px-4 py-10 font-sans">
      <div className="mx-auto max-w-3xl">
        <img src={logoAsset.url} alt="Excursão Brasília" className="w-32" />
        <h1 className="mt-6 text-3xl font-semibold">Proposta de hospedagem</h1>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{p.s.destino}</span>
          <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{fmt(p.s.checkin)} – {fmt(p.s.checkout)} · {nights} noites</span>
          <span className="flex items-center gap-1"><Users className="h-4 w-4" />{p.s.hospedes}</span>
        </div>
        <div className="mt-8 space-y-4">
          {hotels.map((h, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card md:flex">
              {h.image && <img src={h.image} alt={h.name} loading="lazy" className="h-48 w-full object-cover md:w-64" />}
              <div className="flex-1 p-5">
                <div className="text-xs font-semibold text-primary">OPÇÃO {i + 1}</div>
                <div className="mt-1 flex items-center gap-2 text-lg font-semibold">{h.name}<span className="flex">{Array.from({ length: h.stars }).map((_, k) => <Star key={k} className="h-4 w-4 fill-star text-star" />)}</span></div>
                <div className="mt-1 text-sm text-muted-foreground">{h.address}</div>
                {h.room && <div className="mt-1 text-sm text-muted-foreground">{h.room}</div>}
                <div className="mt-4 text-2xl font-bold">{brl(h.total)}</div>
                <div className="text-sm text-muted-foreground">{brl(h.nightly)} / noite · total {nights} noites</div>
              </div>
            </div>))}
        </div>
      </div>
    </div>
  );
}
