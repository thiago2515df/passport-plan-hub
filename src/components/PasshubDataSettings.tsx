import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPasshubDataStatus, verifyPasshubDataAccess } from "@/lib/passhub-data.functions";

const resources = [
  ["reservations", "Reservas"],
  ["issuances", "Emissões"],
  ["payment_links", "Links de pagamento"],
  ["users", "Usuários"],
] as const;

export function PasshubDataSettings({ admin }: { admin: boolean }) {
  const getStatus = useServerFn(getPasshubDataStatus);
  const check = useServerFn(verifyPasshubDataAccess);
  const status = useQuery({ queryKey: ["passhub-data-status"], queryFn: () => getStatus(), enabled: admin, retry: false });
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  if (!admin) return <p className="rounded-xl border border-border bg-card p-4 text-sm">Somente o administrador pode consultar a integração.</p>;
  const ready = status.data?.ready ?? false;
  return <section className="max-w-3xl space-y-5">
    <header className="space-y-2">
      <h2 className="flex items-center gap-2 text-xl font-bold"><Database className="h-5 w-5 text-primary" />API de dados PassHub</h2>
      <p className="text-sm text-muted-foreground">Integração separada da pesquisa de hotéis e passagens. Permite somente leitura dos dados da sua agência, conforme a documentação da PassHub.</p>
    </header>
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-primary" />Chave de acesso</h3>
          <p className="mt-1 text-sm">{status.isPending ? "Verificando configurações…" : status.data?.keyConfigured ? "Chave cadastrada no servidor." : "Aguardando a chave no Lovable."}</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={status.isFetching} onClick={() => { setMessage(""); void status.refetch(); }}>
          <RefreshCw className="h-4 w-4" />Atualizar status
        </Button>
      </div>
      <div className="mt-4 rounded-xl bg-muted/60 p-3 text-sm">
        No Lovable, cadastre a chave em <strong>Secrets</strong> com o nome <code className="font-semibold text-primary">PASSHUB_DATA_API_KEY</code>.
        A chave não deve ser enviada no chat, colocada no código ou exibida para vendedores e clientes.
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span>{ready ? "Configurações mínimas disponíveis para testar a conexão." : "Aguardando os endpoints e a autenticação do guia da API de dados."}</span>
      </div>
    </div>
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h3 className="font-semibold">Módulos de leitura</h3>
      <p className="mt-1 text-xs text-muted-foreground">Os caminhos de acesso serão definidos a partir do guia técnico oficial, sem adivinhar URLs.</p>
      <div className="mt-3 divide-y divide-border">
        {resources.map(([key, label]) => <div key={key} className="flex items-center justify-between gap-3 py-3 text-sm">
          <span>{label}</span>
          <span className="text-xs text-muted-foreground">{status.data?.resources[key] ? "Endpoint configurado" : "Aguardando documentação"}</span>
        </div>)}
      </div>
      <Button type="button" className="mt-3" disabled={!ready || checking} onClick={async () => {
        setChecking(true); setMessage("");
        try { const result = await check(); setMessage(result.message); }
        catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao verificar conexão."); }
        finally { setChecking(false); }
      }}>{checking ? "Testando conexão..." : "Testar conexão"}</Button>
      {message && <p role="status" className="mt-3 rounded-lg bg-muted p-3 text-sm">{message}</p>}
      {status.isError && <p role="alert" className="mt-3 text-sm text-destructive">Não foi possível consultar as configurações da API.</p>}
    </div>
    <p className="text-xs text-muted-foreground">Nenhuma reserva, emissão, cobrança ou usuário será criado, editado ou cancelado por esta integração de leitura. A busca atual de hotéis e passagens permanece inalterada.</p>
  </section>;
}
