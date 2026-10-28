import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database, KeyRound, RefreshCw, ShieldCheck, ChevronLeft, ChevronRight, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPasshubDataStatus, verifyPasshubDataAccess,
  listPasshubAgencyRecords, getPasshubAgencyRecord,
} from "@/lib/passhub-data.functions";
import type { PasshubDataResource } from "@/lib/passhub-data.server";

const resources: { id: PasshubDataResource; label: string }[] = [
  { id: "air", label: "Aéreo" }, { id: "bus", label: "Ônibus" },
  { id: "car", label: "Locação" }, { id: "hotel", label: "Hospedagem" },
  { id: "insurance", label: "Seguros" }, { id: "payment_links", label: "Links de pagamento" },
  { id: "users", label: "Usuários" },
];
type JsonRecord = Record<string, unknown>;

function object(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function pick(value: JsonRecord, fields: string[]): string {
  for (const key of fields) {
    const item = value[key];
    if ((typeof item === "string" || typeof item === "number") && String(item).trim())
      return String(item);
  }
  return "";
}

/** Data API uses each paid product's response shape. Support those list
 * envelopes without fabricating field names or values. */
function unpack(payload: unknown): { rows: JsonRecord[]; meta: JsonRecord } {
  const root = object(payload);
  const candidates: unknown[] = [payload, root?.data, root?.items, root?.orders, root?.reservations, root?.users,
    root?.links, root?.paymentLinks, root?.results];
  const inner = object(root?.data);
  if (inner) candidates.push(inner.items, inner.orders, inner.results, inner.users, inner.links);
  const found = candidates.find(Array.isArray) as unknown[] | undefined;
  return {
    rows: (found ?? []).map(object).filter((row): row is JsonRecord => row !== null),
    meta: object(root?.meta) ?? object(inner?.meta) ?? {},
  };
}

function recordIdentifier(row: JsonRecord): string {
  return pick(row, ["orderId", "linkId", "id", "order_id", "link_id", "uuid"]);
}
function recordTitle(row: JsonRecord, index: number): string {
  return pick(row, ["title", "name", "orderNumber", "orderId", "linkId", "code", "id"]) || `Registro ${index + 1}`;
}
function recordSubtitle(row: JsonRecord): string {
  const nested = object(row.customer) ?? object(row.client);
  const values = [
    pick(row, ["status", "state"]),
    pick(row, ["customerName", "clientName", "description", "email", "createdAt", "created_at"]),
    nested ? pick(nested, ["name"]) : "",
  ].filter(Boolean);
  return values.join(" · ");
}

export function PasshubDataSettings({ admin }: { admin: boolean }) {
  const getStatus = useServerFn(getPasshubDataStatus);
  const verify = useServerFn(verifyPasshubDataAccess);
  const list = useServerFn(listPasshubAgencyRecords);
  const detail = useServerFn(getPasshubAgencyRecord);
  const status = useQuery({
    queryKey: ["passhub-data-status"], queryFn: () => getStatus(), enabled: admin, retry: false,
  });
  const [resource, setResource] = useState<PasshubDataResource>("air");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [response, setResponse] = useState<unknown>(null);
  const [detailResponse, setDetailResponse] = useState<unknown>(null);
  const [detailLabel, setDetailLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const ready = Boolean(status.data?.ready);
  const { rows, meta } = unpack(response);

  const loadPage = async (targetResource: PasshubDataResource, targetPage: number) => {
    setBusy(true); setError(""); setMessage("");
    setDetailResponse(null); setDetailLabel("");
    try {
      const result = await list({ data: { resource: targetResource, page: targetPage, pageSize } });
      setResource(targetResource); setPage(targetPage); setResponse(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível consultar a PassHub.");
      setResource(targetResource); setResponse(null);
    } finally { setBusy(false); }
  };

  const showDetail = async (id: string, payments = false) => {
    if (resource === "users") return;
    setDetailBusy(true); setDetailResponse(null); setError("");
    setDetailLabel(payments ? `Tentativas de pagamento · ${id}` : `Detalhes · ${id}`);
    try {
      const result = await detail({ data: { resource, id, paymentAttempts: payments } });
      setDetailResponse(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível consultar o registro.");
    } finally { setDetailBusy(false); }
  };

  if (!admin) return <p className="rounded-xl border border-border bg-card p-4 text-sm">A consulta de dados da agência é exclusiva para administradores.</p>;
  const totalPages = Number(meta.totalPages ?? meta.total_pages);
  const hasNext = typeof meta.hasNext === "boolean"
    ? meta.hasNext
    : Number.isFinite(totalPages) && totalPages > 0 ? page < totalPages : rows.length === pageSize;

  return <section className="max-w-5xl space-y-5">
    <header>
      <h2 className="flex items-center gap-2 text-xl font-bold"><Database className="h-5 w-5 text-primary" />API de dados PassHub</h2>
      <p className="mt-1 text-sm text-muted-foreground">Reservas, emissões, links de pagamento e usuários da agência. Somente leitura, disponível para o administrador.</p>
    </header>

    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-primary" />Conexão segura</h3>
          <p className="mt-1 text-sm">{status.isPending ? "Verificando..." : ready ? "Chave cadastrada. Pronto para testar." : "Aguardando chave da API de dados no Lovable."}</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={status.isFetching} onClick={() => { void status.refetch(); setMessage(""); }}>
          <RefreshCw className="h-4 w-4" />Atualizar status
        </Button>
      </div>
      <div className="mt-3 rounded-xl bg-muted/60 p-3 text-sm">
        Cadastre somente no servidor, em <strong>Lovable → Secrets</strong>, com o nome <code className="font-semibold text-primary">PASSHUB_DATA_API_KEY</code>. A autenticação usa somente <code>X-Api-Key</code>, sem e-mail, senha ou token Bearer.
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4" />Chave e respostas de erro não são exibidas publicamente. Limite oficial: 60 consultas/minuto.
      </div>
      <Button className="mt-4" type="button" disabled={!ready || checking} onClick={async () => {
        setChecking(true); setMessage(""); setError("");
        try { const result = await verify(); setMessage(result.message); }
        catch (e) { setError(e instanceof Error ? e.message : "Não foi possível verificar a chave."); }
        finally { setChecking(false); }
      }}>{checking ? "Testando..." : "Testar conexão"}</Button>
      {message && <p role="status" className="mt-3 rounded-xl bg-muted p-3 text-sm">{message}</p>}
      {status.isError && <p role="alert" className="mt-3 text-sm text-destructive">Falha ao consultar o status da API.</p>}
    </div>

    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h3 className="font-semibold">Consultar dados da agência</h3>
      <p className="mt-1 text-xs text-muted-foreground">Listagens de pedidos e emissões dos últimos 24 meses (links sem limite de período); detalhes por ID podem incluir registros mais antigos.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Tipo de dados">
        {resources.map(item => <Button key={item.id} type="button" size="sm"
          variant={resource === item.id ? "default" : "outline"} disabled={!ready || busy}
          onClick={() => void loadPage(item.id, 1)}>{item.label}</Button>)}
      </div>
      {busy && <p role="status" className="mt-4 text-sm text-muted-foreground">Consultando registros...</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {!response && !busy && <p className="mt-5 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">{ready ? "Selecione um tipo acima para consultar os registros." : "Cadastre o segredo no Lovable e atualize o status para ativar as consultas."}</p>}
      {response && !busy && <>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>{rows.length} registros nesta página · Página {page}</span>
          <Button size="sm" variant="outline" onClick={() => void loadPage(resource, page)} disabled={busy}><RefreshCw className="h-3.5 w-3.5"/>Atualizar</Button>
        </div>
        {rows.length === 0 && <p className="mt-3 rounded-lg bg-muted/50 p-4 text-sm">Nenhum registro retornado nesta página.</p>}
        <div className="mt-3 divide-y divide-border rounded-xl border border-border">
          {rows.map((row, index) => {
            const id = recordIdentifier(row);
            return <div key={`${id || "row"}-${index}`} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold">{recordTitle(row, index)}</p>
                <p className="break-words text-xs text-muted-foreground">{recordSubtitle(row) || "Registro retornado pela PassHub"}</p>
              </div>
              {resource !== "users" && id && <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={detailBusy} onClick={() => void showDetail(id)}><FileText className="h-4 w-4"/>Detalhes</Button>
                {resource === "payment_links" && <Button type="button" size="sm" variant="outline" disabled={detailBusy} onClick={() => void showDetail(id, true)}>Pagamentos</Button>}
              </div>}
            </div>;
          })}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy || page <= 1} onClick={() => void loadPage(resource, page - 1)}><ChevronLeft className="h-4 w-4"/>Anterior</Button>
          <span className="text-sm text-muted-foreground">Página {page}{Number.isFinite(totalPages) && totalPages > 0 ? ` de ${totalPages}` : ""}</span>
          <Button type="button" variant="outline" size="sm" disabled={busy || !hasNext} onClick={() => void loadPage(resource, page + 1)}>Próxima<ChevronRight className="h-4 w-4"/></Button>
        </div>
      </>}
    </div>

    {(detailBusy || detailResponse !== null) && <div className="rounded-2xl border border-primary/20 bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{detailLabel}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setDetailResponse(null); setDetailLabel(""); }}><X className="h-4 w-4"/>Fechar</Button>
      </div>
      <p className="my-2 text-xs text-muted-foreground">Dados de uso administrativo. Não compartilhe informações pessoais de clientes.</p>
      {detailBusy ? <p role="status" className="text-sm">Carregando detalhes...</p> :
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-all rounded-xl bg-muted p-3 text-xs">{JSON.stringify(detailResponse, null, 2).slice(0, 40000)}</pre>}
    </div>}
  </section>;
}
