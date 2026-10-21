import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSellerCommissions, saveSellerCommissions } from "@/lib/commissions.functions";
import { commissionsSchema } from "@/lib/commission-rules";
import { emptyCommissions, commissionLabel, type SellerCommissions } from "@/lib/package-pricing";

export function CommissionFields({
  value,
  onChange,
}: {
  value: SellerCommissions;
  onChange: (value: SellerCommissions) => void;
}) {
  return (
    <div className="@container space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Defina as três regras. O percentual é acrescentado ao custo dos serviços da opção; o valor
        fixo é acrescentado uma vez por pacote. Somente a regra correspondente ao tipo de pacote
        será aplicada. Zero libera a venda sem comissão.
      </p>
      <div className="grid gap-4 @min-[640px]:grid-cols-3">
        {(
          [
            ["hotel", "Somente hotel", "Hospedagem sem transporte"],
            ["air", "Pacote com aéreo", "Hotel + voos ou apenas voos"],
            ["bus", "Pacote terrestre", "Hospedagem com ônibus"],
          ] as const
        ).map(([key, title, description]) => (
          <fieldset key={key} className="min-w-0 space-y-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-semibold">{title}</legend>
            <p className="text-xs text-muted-foreground">{description}</p>
            <select
              aria-label={`Tipo de comissão: ${title}`}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={value[key].kind}
              onChange={(e) =>
                onChange({
                  ...value,
                  [key]: {
                    ...value[key],
                    kind: e.target.value === "percent" ? "percent" : "fixed",
                  },
                })
              }
            >
              <option value="percent">Percentual (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
            <label className="block text-xs text-muted-foreground">
              {value[key].kind === "percent" ? "Percentual (%)" : "Valor em reais (R$)"}
              <Input
                aria-label={`Comissão: ${title}`}
                className="mt-1"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={value[key].value}
                onChange={(e) =>
                  onChange({
                    ...value,
                    [key]: {
                      ...value[key],
                      value: e.target.value === "" ? 0 : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <p className="text-xs font-semibold">{commissionLabel(value[key])}</p>
          </fieldset>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Exemplo: 20% sobre R$ 1.000 de serviços = R$ 200 de comissão e R$ 1.200 para o cliente.
      </p>
    </div>
  );
}

export function CommissionSettings({
  userId,
  title = "Comissões do vendedor",
}: {
  userId: string;
  title?: string;
}) {
  const read = useServerFn(getSellerCommissions);
  const save = useServerFn(saveSellerCommissions);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["seller-commissions", userId],
    queryFn: () => read({ data: { userId } }),
    enabled: !!userId,
    retry: false,
  });
  const [draft, setDraft] = useState<SellerCommissions | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const values = draft ?? query.data ?? emptyCommissions;
  return (
    <section aria-label={title} className="mb-4 border-t border-border pt-4">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {query.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar as comissões. Atualize o sistema e tente novamente.
        </p>
      ) : (
        <>
          <p
            className={`mb-4 text-xs ${query.data?.configured ? "text-muted-foreground" : "font-semibold text-amber-800"}`}
          >
            {query.data?.configured
              ? "Confirmadas pelo administrador. Aplicativo e web usam estas mesmas regras."
              : "Pesquisas bloqueadas até você salvar e confirmar as três regras. Revise também os valores já existentes."}
          </p>
          <CommissionFields
            value={values}
            onChange={(value) => {
              setDraft(value);
              setMessage("");
            }}
          />
          <Button
            type="button"
            size="sm"
            className="mt-4"
            disabled={busy || !commissionsSchema.safeParse(values).success}
            onClick={async () => {
              setBusy(true);
              setMessage("");
              try {
                await save({ data: { userId, ...values } });
                setDraft(null);
                await Promise.all([
                  client.invalidateQueries({ queryKey: ["seller-commissions"] }),
                  client.invalidateQueries({ queryKey: ["proposal-board"] }),
                  client.invalidateQueries({ queryKey: ["settings"] }),
                ]);
                setMessage(
                  "Comissões confirmadas. Pesquisas liberadas e propostas em aberto atualizadas no aplicativo e na web.",
                );
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "Não foi possível salvar as comissões.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save className="h-4 w-4" />
            {busy ? "Salvando…" : "Salvar e confirmar comissões"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Pacotes já aceitos mantêm a comissão e o preço da confirmação.
          </p>
        </>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </section>
  );
}
