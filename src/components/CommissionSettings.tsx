import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSellerCommissions, saveSellerCommissions } from "@/lib/commissions.functions";
import { emptyCommissions, type SellerCommissions } from "@/lib/package-pricing";

export function CommissionFields({ value, onChange }: { value: SellerCommissions; onChange: (value: SellerCommissions) => void }) {
  return <div className="grid gap-4 sm:grid-cols-2">{([['air', 'Comissão aérea'], ['bus', 'Comissão terrestre']] as const).map(([key, title]) => <fieldset key={key} className="min-w-0 space-y-2"><legend className="mb-2 text-sm font-semibold">{title}</legend><select aria-label={`Tipo de ${title.toLowerCase()}`} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={value[key].kind} onChange={e => onChange({ ...value, [key]: { ...value[key], kind: e.target.value === 'percent' ? 'percent' : 'fixed' } })}><option value="fixed">Valor fixo (R$)</option><option value="percent">Percentual (%)</option></select><Input aria-label={title} type="number" min={0} step="0.01" value={value[key].value} onChange={e => onChange({ ...value, [key]: { ...value[key], value: Math.max(0, Number(e.target.value)) } })} /></fieldset>)}</div>;
}
export function CommissionSettings({ userId }: { userId: string }) {
  const read = useServerFn(getSellerCommissions); const save = useServerFn(saveSellerCommissions); const client = useQueryClient();
  const query = useQuery({ queryKey: ['seller-commissions', userId], queryFn: () => read({ data: { userId } }), enabled: !!userId });
  const [draft, setDraft] = useState<SellerCommissions | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  return <section aria-label="Comissões do vendedor" className="mb-6 border-y border-border py-5"><h2 className="mb-4 font-semibold">Comissões do vendedor</h2>{query.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : query.isError ? <p role="alert">Não foi possível carregar as comissões.</p> : <><CommissionFields value={draft ?? query.data ?? emptyCommissions} onChange={setDraft} /><Button type="button" size="sm" className="mt-4" disabled={busy} onClick={async () => { setBusy(true); setMessage(''); try { await save({ data: { userId, ...(draft ?? query.data ?? emptyCommissions) } }); setDraft(null); await client.invalidateQueries({ queryKey: ['seller-commissions'] }); await client.invalidateQueries({ queryKey: ['proposal-board'] }); setMessage('Comissões salvas. Preços atualizados.'); } catch { setMessage('Não foi possível salvar as comissões.'); } finally { setBusy(false); } }}><Save className="h-4 w-4" />Salvar comissões</Button></>}{message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}</section>;
}