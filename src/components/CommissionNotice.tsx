import { Link } from "@tanstack/react-router";
import { Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/components/AccessProvider";
import { commissionLabel } from "@/lib/package-pricing";
import {
  COMMISSION_MIGRATION_REQUIRED,
  COMMISSION_INVALID,
  COMMISSION_UNAVAILABLE,
} from "@/lib/commission-rules";
import type { useSellerCommissions } from "@/hooks/use-seller-commissions";

export function CommissionNotice({ query }: { query: ReturnType<typeof useSellerCommissions> }) {
  const access = useAccess();
  if (!access.allowed) return null;
  if (query.isPending)
    return (
      <p role="status" className="my-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando comissões…
      </p>
    );
  if (query.isError)
    return (
      <div
        role="alert"
        className="my-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
      >
        <p>
          {query.error instanceof Error
            ? query.error.message
            : "Não foi possível verificar as comissões."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => void query.refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  if (query.data?.issue)
    return (
      <div
        role="alert"
        className="my-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
      >
        <p>
          {query.data.issue === "migration_required"
            ? COMMISSION_MIGRATION_REQUIRED
            : query.data.issue === "invalid_data"
              ? COMMISSION_INVALID
              : COMMISSION_UNAVAILABLE}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => void query.refetch()}
        >
          Verificar novamente
        </Button>
      </div>
    );
  if (!query.ready)
    return (
      <div
        role="alert"
        className="my-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
      >
        <p className="flex items-center gap-2 font-semibold">
          <LockKeyhole className="h-4 w-4 shrink-0" />
          Comissões pendentes de confirmação
        </p>
        <p className="mt-1">
          {access.admin
            ? "Cadastre e confirme as três regras de comissão para liberar pesquisas e propostas desta conta."
            : "O administrador precisa cadastrar e confirmar suas comissões para liberar pesquisas e propostas."}
        </p>
        {access.admin && (
          <Link
            to="/configuracoes"
            className="mt-2 inline-flex min-h-9 items-center font-semibold underline"
          >
            Configurar comissões
          </Link>
        )}
      </div>
    );
  return null;
}
