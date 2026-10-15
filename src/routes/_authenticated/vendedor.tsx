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
import { AcceptedPackageDetails } from "@/components/AcceptedPackageDetails";
import { packagePricing } from "@/lib/package-pricing";
import { setProposalStatus } from "@/lib/proposals.functions";
import { decodeProposal, brl, nightsBetween } from "@/lib/hotels";
import { proposalShareMessage } from "@/lib/proposal-message";
import { FileText, Send, CheckCircle2, Clock, Plus, ExternalLink, Pencil, Phone, UserRound, CalendarDays, MapPin, XCircle, Search, GripVertical, Loader2, Archive } from "lucide-react";


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
const archiveUntil = (value: string) => new Date(new Date(value).getTime() + 30 * 86400000).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

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
  const [showArchive, setShowArchive] = useState(false);
  const mutation = useMutation({ mutationFn: changeStatus, onSuccess: async () => { setPending(null); await client.invalidateQueries({ queryKey: ["proposal-board"] }); await client.invalidateQueries({ queryKey: ["settings"] }); } });
  const filtered = rows.filter(row => { const p = decodeProposal(row.payload); return `${p?.s.cliente ?? ""} ${p?.s.destino ?? ""} ${row.seller_name} ${row.code}`.toLowerCase().includes(q.toLowerCase()); });
  const activeFiltered = filtered.filter(row => row.status !== "cancelled");
  const archivedFiltered = filtered.filter(row => row.status === "cancelled");
  const archivedCount = rows.filter(row => row.status === "cancelled").length;
  const request = (code: string, status: Status) => { const row = rows.find(r => r.code === code); if (!row) return; const s = decodeProposal(row.payload)?.s; mutation.reset(); setCopyState("idle"); setPending({ code, status, client: s?.cliente || "Cliente", ...(s?.telefone ? { phone: s.telefone } : {}) }); };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <ManagementNav current="seller" />
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 space-y-5">
        
        {/* PROPOSTAS / VENDAS HEADER E CONTEÚDO ORIGINAL */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{access.admin ? "Visão geral da equipe" : "Meu espaço de vendas"}</p>
            <h1 className="text-2xl font-bold">Propostas</h1>
            <p className="mt-1 text-xs text-muted-foreground">{rows.filter(r => r.status !== "cancelled").length} propostas ativas · {rows.filter(r => r.status === "awaiting").length} aguardando resposta</p>
          </div>
          <Button asChild><Link to="/pacotes" search={{}}><Plus />Nova proposta</Link></Button>
        </header>
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input aria-label="Buscar proposta" className="h-9 min-w-0 max-w-md flex-1 bg-card" placeholder={showArchive ? "Buscar no arquivo" : "Cliente, destino ou vendedor"} value={q} onChange={e => navigate({ search: { q: e.target.value }, replace: true })} />
          <Button type="button" size="sm" variant={showArchive ? "secondary" : "ghost"} className="ml-auto text-xs" onClick={() => setShowArchive(v => !v)}><Archive className="h-4 w-4" />Arquivo{archivedCount ? ` (${archivedCount})` : ""}</Button>
        </div>
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
          {columns.map(column => { const cards = activeFiltered.filter(row => column.id === "closed" ? row.status === "approved" : row.status === column.id); return <section key={column.id} aria-label={column.title} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragged) request(dragged, column.id === "closed" ? "approved" : column.id); setDragged(null); }} className="min-w-0 rounded-2xl bg-secondary/30 p-2.5">
            <div className={`mb-2 flex items-center justify-between border-b-2 ${column.line} pb-2`}><h2 className="flex items-center gap-2 text-sm font-semibold"><column.icon className={`h-4 w-4 ${column.tone}`} />{column.title}</h2><span className="grid h-6 min-w-6 place-items-center rounded-md bg-secondary px-1 text-xs font-semibold">{cards.length}</span></div>
            <div className="min-h-40 space-y-2">{cards.map(row => { const p = decodeProposal(row.payload); const s = p?.s; const minimum = p?.hotels.length ? Math.min(...p.hotels.map(h => packagePricing(h.total, p.s, row.commissions).total)) : null; return <article key={row.code} draggable onDragStart={() => setDragged(row.code)} onDragEnd={() => setDragged(null)} className="rounded-xl border border-border bg-card p-3 shadow-none transition hover:border-primary/35">
              <div className="mb-2 flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[10px] text-muted-foreground">#{row.code}</p><h3 className="mt-0.5 truncate text-sm font-semibold">{s?.cliente || "Cliente não informado"}</h3></div><GripVertical aria-label="Mover proposta" className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" /></div>
              {row.status !== "created" && <span className={`mb-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${row.status === "approved" ? "bg-success text-success-foreground" : row.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`}>{row.status === "approved" ? "Aprovada" : row.status === "cancelled" ? "Cancelada" : "Proposta enviada"}</span>}
              <div className="space-y-1.5 text-[11px]"><p className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="break-words">{s?.origem?.split(",")[0] || "Origem"} → {s?.destino?.split(",")[0] || "Destino"}</span></p>{s && <p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />{date(s.checkin)} – {date(s.checkout)} · {nightsBetween(s.checkin, s.checkout)} noites</p>}<p className="break-words text-muted-foreground">{s?.hospedes || "Hóspedes não informados"}</p>{s?.telefone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{s.telefone}</p>}{s?.email && <p className="break-all text-muted-foreground">{s.email}</p>}
              {!row.acceptance && <div className="mt-1 flex items-end justify-between gap-3 border-t border-border pt-2"><span className="text-[10px] text-muted-foreground">{p?.hotels.length ?? 0} {p?.hotels.length === 1 ? "hotel" : "hotéis"}</span>{minimum !== null && <p className="text-sm font-bold">{p && p.hotels.length > 1 ? "A partir de " : ""}{brl(minimum)}</p>}</div>}</div>
              {row.acceptance && <details className="mt-2 rounded-lg bg-secondary/50 px-2.5 py-2 text-[11px]"><summary className="cursor-pointer font-semibold text-success-foreground">Pacote aceito · {brl(row.acceptance.total)}</summary><AcceptedPackageDetails acceptance={row.acceptance} /></details>}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[10px] text-muted-foreground"><p className="flex items-start gap-2"><UserRound className="h-3.5 w-3.5 shrink-0" /><span className="break-all">{row.seller_name}</span></p><p>Criada em {dateTime(row.created_at)}</p>{row.sent_at && <p>Enviada em {dateTime(row.sent_at)}</p>}</div>
              <div className="mt-2 flex flex-wrap gap-1.5"><Button variant="outline" size="sm" asChild><a href={`/p/${row.code}`} target="_blank" rel="noreferrer"><ExternalLink />Abrir</a></Button><Button variant="ghost" size="sm" asChild><Link to="/pacotes" search={{ code: row.code }}><Pencil />Editar</Link></Button></div>
              <div className="mt-2 flex flex-wrap gap-1.5">{row.status === "created" && <Button size="sm" className="w-full" onClick={() => request(row.code, "awaiting")}><Send />Enviar proposta</Button>}{row.status === "awaiting" && <Button size="sm" variant="secondary" onClick={() => request(row.code, "approved")}><CheckCircle2 />Aprovar</Button>}{row.status !== "cancelled" && row.status !== "approved" && <Button size="sm" variant="ghost" onClick={() => request(row.code, "cancelled")}><XCircle />Cancelar</Button>}{["approved", "cancelled"].includes(row.status) && <Button size="sm" variant="ghost" onClick={() => request(row.code, "created")}>Reabrir</Button>}</div>
            </article>; })}{!cards.length && <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground"><column.icon className="h-6 w-6" /><span>{q ? "Nenhum resultado" : "Nenhuma proposta"}</span></div>}</div>
          </section>;})}
        </div>
        {showArchive && <section className="rounded-2xl border border-border bg-card p-3 sm:p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><Archive className="h-4 w-4 text-muted-foreground" />Arquivo de propostas</h2><p className="mt-1 text-[11px] text-muted-foreground">Propostas canceladas ou vencidas ficam aqui por 30 dias e depois são excluídas definitivamente.</p></div><span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold">{archivedFiltered.length}</span></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{archivedFiltered.map(row => { const p = decodeProposal(row.payload); const s = p?.s; return <article key={row.code} className="rounded-xl border border-border bg-secondary/20 p-3 text-xs"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[10px] text-muted-foreground">#{row.code}</p><h3 className="truncate text-sm font-semibold">{s?.cliente || "Cliente não informado"}</h3></div><span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Arquivada</span></div><p className="mt-2 flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{s?.origem?.split(",")[0] || "Origem"} → {s?.destino?.split(",")[0] || "Destino"}</p>{s && <p className="mt-1 flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{date(s.checkin)} – {date(s.checkout)}</p>}<p className="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground">Exclusão automática em {archiveUntil(row.updated_at)}</p></article>; })}{!archivedFiltered.length && <div className="col-span-full rounded-xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground">{q ? "Nenhuma proposta arquivada encontrada." : "O arquivo está vazio."}</div>}</div></section>}
        <Dialog open={!!pending} onOpenChange={open => { if (!open && !mutation.isPending) setPending(null); }}><DialogContent><DialogHeader><DialogTitle>{pending?.status === "awaiting" ? "Enviar proposta" : pending?.status === "approved" ? "Confirmar aprovação" : pending?.status === "cancelled" ? "Cancelar proposta" : "Reabrir proposta"}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{pending?.client}</p>{pending?.status === "awaiting" && <div className="space-y-3"><Button variant="outline" className="w-full" onClick={() => { if (!pending) return; let phone = (pending.phone ?? "").replace(/\D/g, ""); if (phone.length === 10 || phone.length === 11) phone = `55${phone}`; const text = encodeURIComponent(shareMessage); window.open(`https://wa.me/${phone}?text=${text}`, "_blank", "noopener,noreferrer"); }}><Send />Abrir no WhatsApp</Button><Button variant="ghost" className="w-full" disabled={!shareMessage} onClick={async () => { try { await navigator.clipboard.writeText(shareMessage); setCopyState("copied"); } catch { setCopyState("error"); } }}>{copyState === "copied" ? "Mensagem copiada!" : "Copiar link"}</Button>{copyState !== "idle" && <p role="status" className="text-sm text-muted-foreground">{copyState === "copied" ? "Texto e link copiados." : "Não foi possível copiar. Tente novamente ou abra no WhatsApp."}</p>}<p className="text-sm text-muted-foreground">O envio já foi realizado?</p></div>}{mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}<DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={() => setPending(null)}>Voltar</Button><Button disabled={mutation.isPending || !pending} onClick={() => { if (pending) mutation.mutate({ data: { code: pending.code, status: pending.status } }); }}>{mutation.isPending && <Loader2 className="animate-spin" />}{pending?.status === "awaiting" ? "Confirmar envio" : "Confirmar"}</Button></DialogFooter></DialogContent></Dialog>
      </main>
    </div>
  );
}
