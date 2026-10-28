import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Landmark, QrCode, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getPaymentRules, savePaymentRules } from "@/lib/settings.functions";
import { DEFAULT_PAYMENT_RULES, type PaymentRules } from "@/lib/payment-rules";

const pct = (value: number) => Number.isFinite(value) ? String(value).replace(".", ",") : "0";
const number = (value: string) => Number(value.replace(",", "."));

export function PaymentRulesSettings({ admin }: { admin: boolean }) {
  const load = useServerFn(getPaymentRules);
  const save = useServerFn(savePaymentRules);
  const [rules, setRules] = useState<PaymentRules>(DEFAULT_PAYMENT_RULES);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!admin) return;
    let active = true;
    setLoading(true);
    load().then(result => { if (active) setRules(result); })
      .catch(() => { if (active) setMessage("Não foi possível carregar as regras. Usando os padrões."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin, load]);

  const setCardRate = (index: number, value: string) => {
    if (index < 6) return;
    const next = [...rules.card.visaMaster];
    next[index] = Math.max(0, Math.min(50, number(value) || 0));
    setRules({ ...rules, card: { ...rules.card, visaMaster: next, otherBrands: [...next] } });
  };
  const setBoletoRate = (index: number, value: string) => {
    const next = [...rules.boleto.fees];
    next[index] = Math.max(0, Math.min(50, number(value) || 0));
    setRules({ ...rules, boleto: { ...rules.boleto, fees: next } });
  };

  return <section className="max-w-4xl space-y-6">
    <header>
      <h2 className="text-xl font-semibold">Formas de pagamento da proposta</h2>
      <p className="mt-1 text-sm text-muted-foreground">Estas regras são copiadas para cada proposta no momento em que ela é gerada. Alterações futuras não mudam propostas antigas.</p>
    </header>

    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary"/><div><h3 className="font-semibold">Cartão de crédito</h3><p className="text-xs text-muted-foreground">1x a 6x sem juros. Configure juros somente de 7x a 12x.</p></div></div>
        <Switch checked={rules.card.enabled} onCheckedChange={enabled => setRules({ ...rules, card: { ...rules.card, enabled } })}/>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2">Parcelas</th><th>Condição</th></tr></thead>
          <tbody>{Array.from({ length: 12 }).map((_, i) => <tr key={i} className="border-b border-border/60">
            <td className="py-2 font-semibold">{i + 1}x</td>
            <td>{i < 6
              ? <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Sem juros</span>
              : <div className="flex items-center gap-1"><Input aria-label={`Juros do cartão em ${i+1} parcelas`} value={pct(rules.card.visaMaster[i]!)} onChange={e => setCardRate(i, e.target.value)} inputMode="decimal" className="h-9 max-w-28"/><span>% juros</span></div>}
            </td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>

    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary"/><h3 className="font-semibold">Pix</h3></div><Switch checked={rules.pix.enabled} onCheckedChange={enabled => setRules({ ...rules, pix: { ...rules.pix, enabled } })}/></div>
        <label className="mt-4 block text-sm">Desconto à vista (%)<Input className="mt-1" value={pct(rules.pix.discountPercent)} inputMode="decimal" onChange={e => setRules({ ...rules, pix: { ...rules.pix, discountPercent: Math.max(0, Math.min(50, number(e.target.value) || 0)) } })}/></label>
        <label className="mt-3 block text-sm">Observação<Input className="mt-1" maxLength={160} value={rules.pix.note} onChange={e => setRules({ ...rules, pix: { ...rules.pix, note: e.target.value } })}/></label>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Landmark className="h-5 w-5 text-primary"/><h3 className="font-semibold">Boleto</h3></div><Switch checked={rules.boleto.enabled} onCheckedChange={enabled => setRules({ ...rules, boleto: { ...rules.boleto, enabled } })}/></div>
        <label className="mt-4 block text-sm">Máximo de parcelas<Input className="mt-1" type="number" min={1} max={12} value={rules.boleto.maxInstallments} onChange={e => setRules({ ...rules, boleto: { ...rules.boleto, maxInstallments: Math.max(1, Math.min(12, Number(e.target.value) || 1)) } })}/></label>
        <label className="mt-3 block text-sm">Observação<Input className="mt-1" maxLength={160} value={rules.boleto.note} onChange={e => setRules({ ...rules, boleto: { ...rules.boleto, note: e.target.value } })}/></label>
      </div>
    </div>

    {rules.boleto.enabled && <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h3 className="font-semibold">Taxas do boleto por parcela</h3>
      <p className="mt-1 text-xs text-muted-foreground">Deixe 0% quando não houver acréscimo.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: rules.boleto.maxInstallments }).map((_, i) => <label key={i} className="text-xs">{i + 1}x<div className="mt-1 flex items-center gap-1"><Input value={pct(rules.boleto.fees[i]!)} inputMode="decimal" onChange={e => setBoletoRate(i, e.target.value)} className="h-9"/><span>%</span></div></label>)}
      </div>
    </div>}

    {message && <p role="status" className="rounded-xl border border-border bg-secondary p-3 text-sm">{message}</p>}
    <Button disabled={!admin || busy || loading} onClick={async () => {
      setBusy(true); setMessage("");
      try { await save({ data: rules }); setMessage("Formas de pagamento salvas. As próximas propostas usarão estas regras."); }
      catch (e) { setMessage(e instanceof Error ? e.message : "Não foi possível salvar."); }
      finally { setBusy(false); }
    }}><Save className="h-4 w-4"/>{busy ? "Salvando..." : "Salvar formas de pagamento"}</Button>
  </section>;
}
