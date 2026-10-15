import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Building2, Clock3 } from "lucide-react";
import { decodeProposal } from "@/lib/hotels";
import { getProposal } from "@/lib/proposals.functions";
import { proposalPreviewMeta } from "@/lib/proposal-preview";
import { ProposalView } from "../proposta";

export const Route = createFileRoute("/p/$code")({
  head: () => ({
    meta: [
      { title: "Proposta exclusiva — Excursão Brasília" },
      { name: "description", content: "Confira as opções de hospedagem selecionadas especialmente para você." },
      { property: "og:title", content: "Proposta exclusiva — Excursão Brasília" },
      { property: "og:description", content: "Opções de hotéis selecionadas pela Excursão Brasília." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...proposalPreviewMeta,
    ],
  }),
  component: ShortProposal,
});

function ShortProposal() {
  const { code } = Route.useParams();
  const fetchProposal = useServerFn(getProposal);
  const [payload, setPayload] = useState<string | null | undefined>(undefined);
  const [acceptance, setAcceptance] = useState<{ hotelIndex: number; acceptedAt: string; total: number } | null>(null);
  const [state, setState] = useState<"active" | "approved" | "expired" | "cancelled" | "missing" | "loading">("loading");

  useEffect(() => {
    let alive = true;
    const refresh = () => fetchProposal({ data: code }).then(r => { if (alive) { setPayload(r.payload); setAcceptance(r.acceptance); setState(r.state); } }).catch(() => { if (alive) { setPayload(null); setState("missing"); } });
    void refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [code, fetchProposal]);

  if (payload === undefined) {
    return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Carregando proposta…</div>;
  }
  const p = payload ? decodeProposal(payload) : null;
  if (!p) {
    const unavailable = state === "expired" || state === "cancelled";
    return (
      <div className="grid min-h-screen place-items-center bg-background px-5 text-muted-foreground">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-md">
          {unavailable ? <Clock3 className="mx-auto mb-4 h-14 w-14 text-primary" /> : <Building2 className="mx-auto mb-4 h-14 w-14 text-primary/60" />}
          <h2 className="text-2xl font-bold text-foreground">{unavailable ? "Esta proposta está vencida" : "Proposta inválida ou expirada"}</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed">{unavailable ? "Esta proposta não está mais válida. Procure o seu agente de viagens para receber uma nova cotação atualizada." : "Verifique o link recebido com o seu agente de viagens."}</p>
        </div>
      </div>
    );
  }
  return <ProposalView p={p} code={code} acceptance={acceptance} />;
}
