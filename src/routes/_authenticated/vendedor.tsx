import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ManagementNav } from "@/components/ManagementNav";
import { useAccess } from "@/components/AccessProvider";
import { Button } from "@/components/ui/button";
import { listMyProposals } from "@/lib/settings.functions";
import { decodeProposal } from "@/lib/hotels";
import { FileText } from "lucide-react";
export const Route = createFileRoute("/_authenticated/vendedor")({ head: () => ({ meta: [ { title: "Minhas propostas — Excursão Brasília" }, { name: "description", content: "Página individual do vendedor da Excursão Brasília." }, { property: "og:title", content: "Minhas propostas — Excursão Brasília" }, { property: "og:description", content: "Propostas individuais do vendedor." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" } ] }), component: SellerPage });
function SellerPage() {
  const access = useAccess(); const list = useServerFn(listMyProposals);
  const rows = useQuery({ queryKey: ["my-proposals", access.userId], queryFn: () => list(), enabled: access.allowed, retry: false });
  return <div className="min-h-screen bg-background text-foreground"><ManagementNav current="seller" /><main className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><p className="mb-2 text-sm text-muted-foreground">{access.name || "Área do vendedor"}</p><h1 className="mb-8 text-3xl font-bold">Minhas propostas</h1>{!access.allowed ? <p className="border-y border-border py-8 text-muted-foreground">Acesso pendente. Sua conta precisa ser liberada pelo administrador.</p> : <><p className="mb-6 text-sm text-muted-foreground">{rows.data?.length ?? 0} propostas</p>{rows.isError && <p className="text-destructive">Não foi possível carregar as propostas.</p>}{rows.data?.map(row => { const p = decodeProposal(row.payload); return <div key={row.code} className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-5"><div><h2 className="font-semibold">{p?.s.cliente || "Cliente"}</h2><p className="text-sm text-muted-foreground">{p?.s.destino} · {new Date(row.created_at).toLocaleDateString("pt-BR")}</p></div><Button variant="outline" asChild><a href={`/p/${row.code}`} target="_blank" rel="noreferrer">Abrir proposta</a></Button></div>; })}{!rows.data?.length && <div className="py-16 text-center"><FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground" /><h2 className="font-semibold">Nenhuma proposta criada</h2></div>}</>}</main></div>;
}