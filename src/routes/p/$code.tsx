import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { decodeProposal } from "@/lib/hotels";
import { getProposal } from "@/lib/proposals.functions";
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
    ],
  }),
  component: ShortProposal,
});

function ShortProposal() {
  const { code } = Route.useParams();
  const fetchProposal = useServerFn(getProposal);
  const [payload, setPayload] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    fetchProposal({ data: code }).then(r => setPayload(r.payload)).catch(() => setPayload(null));
  }, [code, fetchProposal]);

  if (payload === undefined) {
    return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Carregando proposta…</div>;
  }
  const p = payload ? decodeProposal(payload) : null;
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
  return <ProposalView p={p} />;
}
