import { decodeProposal, brl } from "@/lib/hotels";
import type { ProposalAcceptance } from "@/lib/proposal-acceptance";
export function AcceptedPackageDetails({ acceptance }: { acceptance: ProposalAcceptance }) {
  const p = decodeProposal(acceptance.payload);
  const h = p?.hotels[acceptance.hotel_index];
  if (!p || !h) return null;
  const t = p.s.transport;
  return <div className="mt-3 space-y-3 border-t border-border pt-3 text-xs">
    <div><p className="font-semibold text-success-foreground">Pacote aceito pelo cliente</p><p className="mt-1 break-words text-sm font-bold">{h.name}</p><p className="mt-1 break-words text-muted-foreground">{h.room}</p><p className="mt-1 text-muted-foreground">{p.s.checkin.split('-').reverse().join('/')} – {p.s.checkout.split('-').reverse().join('/')} · {p.s.hospedes}</p></div>
    {t && t.mode !== 'none' && <div className="space-y-1"><p className="font-semibold">{t.mode === 'air' ? 'Passagem aérea' : 'Ônibus'}</p>{([['Ida',t.outbound],['Volta',t.inbound]] as const).map(([label,leg]) => <p key={label} className="break-words text-muted-foreground">{label}: {leg.company} · {leg.from || p.s.origem} → {leg.to || p.s.destino} · {leg.departure} – {leg.arrival}{leg.stops ? ` · ${leg.stops}` : ''}</p>)}</div>}
    {!!p.s.extras?.length && <div><p className="font-semibold">Adicionais</p>{p.s.extras.map((item,i) => <p key={i}>{item.name} · {brl(item.cost)}</p>)}</div>}
    <dl className="space-y-2">{[['Hospedagem',acceptance.hotel_cost],['Transporte',acceptance.transport_cost],['Adicionais',acceptance.extras_cost]] .map(([label,value]) => <div key={label} className="flex justify-between gap-2"><dt>{label}</dt><dd>{brl(Number(value))}</dd></div>)}<div className="flex justify-between gap-2 font-semibold text-success-foreground"><dt>Comissão da vendedora{acceptance.commission_kind === 'percent' ? ` (${acceptance.commission_value}%)` : ''}</dt><dd>{brl(acceptance.commission)}</dd></div><div className="flex justify-between gap-2 border-t border-border pt-2 text-sm font-bold"><dt>Valor aceito</dt><dd>{brl(acceptance.total)}</dd></div></dl>
    <p className="text-muted-foreground">Aceito em {new Date(acceptance.accepted_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
  </div>;
}