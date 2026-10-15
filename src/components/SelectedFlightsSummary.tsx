import { BriefcaseBusiness, Clock3, CreditCard, Eye, Luggage, Trash2, X } from "lucide-react";
import { brl, type Flight } from "@/lib/hotels";
import { AZUL_LOGO, GOL_LOGO, LATAM_LOGO } from "@/lib/airline-logos";

type Direction = "out" | "back";

type SelectedFlightsSummaryProps = {
  outbound?: Flight;
  inbound?: Flight;
  outboundDate?: string;
  inboundDate?: string;
  onRemove: (direction: Direction) => void;
  onShowOptions: (direction: Direction) => void;
};

const datePt = (value?: string, fallback?: string) => {
  const raw = value || fallback;
  if (!raw) return "";
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? raw.slice(0, 10);
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const timePt = (value?: string) => {
  if (!value) return "--:--";
  const match = value.match(/(?:T|\s)?(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : value;
};

const airlineLogo = (flight: Flight) => {
  const key = `${flight.airline ?? ""} ${flight.flightNumber ?? ""}`.toUpperCase();
  if (key.includes("GOL") || /\bG3\s*\d/.test(key)) return { src: GOL_LOGO, alt: "GOL" };
  if (key.includes("LATAM") || /\bLA\s*\d/.test(key)) return { src: LATAM_LOGO, alt: "LATAM" };
  if (key.includes("AZUL") || /\bAD\s*\d/.test(key)) return { src: AZUL_LOGO, alt: "Azul" };
  return null;
};

function BaggageIcons({ flight }: { flight: Flight }) {
  const baggage = flight.baggage;
  const generic = (flight.bags ?? "").toLowerCase();
  const personal = baggage?.personal ?? /pessoal|personal/.test(generic);
  const carryOn = baggage?.carryOn ?? /m[aã]o|carry/.test(generic);
  const checked = baggage?.checked ?? /despach|checked/.test(generic);

  return (
    <div className="flex items-center justify-center gap-2.5 text-slate-700">
      <span title={personal ? "Item pessoal incluído" : "Item pessoal"}>
        <BriefcaseBusiness className={`h-5 w-5 ${personal ? "" : "opacity-55"}`} />
      </span>
      <span title={carryOn ? "Bagagem de mão incluída" : "Bagagem de mão"}>
        <Luggage className={`h-5 w-5 ${carryOn ? "" : "opacity-55"}`} />
      </span>
      <span className="relative" title={checked ? "Bagagem despachada incluída" : "Bagagem despachada não incluída"}>
        <Luggage className={`h-5 w-5 ${checked ? "" : "opacity-65"}`} />
        {!checked && <X className="absolute -right-1.5 -top-1.5 h-4 w-4 stroke-[3] text-red-500" />}
      </span>
    </div>
  );
}

function SelectedFlightCard({
  direction,
  flight,
  fallbackDate,
  onRemove,
  onShowOptions,
}: {
  direction: Direction;
  flight: Flight;
  fallbackDate?: string;
  onRemove: (direction: Direction) => void;
  onShowOptions: (direction: Direction) => void;
}) {
  const logo = airlineLogo(flight);
  const departureDate = datePt(flight.departureDate, fallbackDate);
  const arrivalDate = datePt(flight.arrivalDate, fallbackDate);
  const installments = flight.installments?.count;
  const commission = flight.commission ?? 0;
  const title = direction === "out" ? "Voo de ida selecionado" : "Voo de volta selecionado";
  const travelClass = (flight.travelClass || flight.fareCategory || "Econômica").toUpperCase();

  return (
    <section className="selected-flight-wrapper">
      <div className="selected-flight-heading">
        <div>
          <h3>{title}</h3>
          <span>{departureDate}</span>
        </div>
        <div className="selected-flight-actions">
          <button type="button" title="Visualizar voo" aria-label={`Visualizar ${title.toLowerCase()}`} onClick={() => onShowOptions(direction)}>
            <Eye className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onShowOptions(direction)}>Ver todas as opções</button>
        </div>
      </div>

      <div className="selected-flight-card">
        <div className="selected-flight-airline">
          {logo ? (
            <img src={logo.src} alt={logo.alt} />
          ) : (
            <div className="selected-flight-airline-fallback">{flight.airline || flight.flightNumber?.slice(0, 2)}</div>
          )}
        </div>

        <div className="selected-flight-details">
          <div className="selected-flight-class">{travelClass} <span>•</span> {flight.flightNumber}</div>
          <div className="selected-flight-route">
            <div className="selected-flight-point">
              <strong>{departureDate}</strong>
              <span>{timePt(flight.departure)}</span>
              <b>{flight.from}</b>
            </div>

            <div className="selected-flight-duration">
              <div />
              <span><Clock3 className="h-3.5 w-3.5" />{flight.duration || "Direto"}</span>
              <div />
            </div>

            <div className="selected-flight-point selected-flight-point-right">
              <strong>{arrivalDate}</strong>
              <span>{timePt(flight.arrival)}</span>
              <b>{flight.to}</b>
            </div>
          </div>

          <div className="selected-flight-info-icons">
            <span title="Informações do voo" className="grid h-5 w-5 place-items-center rounded-full border border-current text-[10px] font-bold">i</span>
            <CreditCard className="h-4 w-4" />
          </div>
        </div>

        <div className="selected-flight-price">
          <strong>{brl(flight.price)}</strong>
          <span>{installments ? `até ${installments}x${flight.installments?.interestFree === false ? "" : " s/ juros"}` : "valor da passagem"}</span>
          {commission > 0 && <div className="selected-flight-commission">Comissão: {brl(commission)}</div>}
          <BaggageIcons flight={flight} />
          <button className="selected-flight-remove" type="button" aria-label={`Remover ${title.toLowerCase()}`} onClick={() => onRemove(direction)}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

const selectedFlightStyles = String.raw`
.selected-flights-summary{display:grid;gap:16px;margin-top:16px;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#16213a}
.selected-flight-wrapper{width:100%}
.selected-flight-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px;padding:0 2px}
.selected-flight-heading h3{margin:0;color:#15213b;font-size:15px;line-height:1.1;font-weight:800}
.selected-flight-heading>div:first-child>span{display:block;margin-top:2px;color:#8190aa;font-size:10px}
.selected-flight-actions{display:flex;align-items:center;gap:8px}
.selected-flight-actions button{display:inline-flex;height:32px;align-items:center;justify-content:center;border:1px solid #cfd8e7;border-radius:8px;background:#fff;color:#15213b;font-size:11px;font-weight:700;cursor:pointer;transition:.18s ease}
.selected-flight-actions button:first-child{width:34px;padding:0}.selected-flight-actions button:first-child svg{width:15px;height:15px}.selected-flight-actions button:last-child{padding:0 12px}.selected-flight-actions button:hover{border-color:#2744e6;background:#f5f8ff}
.selected-flight-card{display:grid;grid-template-columns:112px minmax(0,1fr) 185px;min-height:132px;overflow:hidden;border:2px solid #2744e6;border-radius:14px;background:#fff;box-shadow:0 3px 10px rgba(16,40,80,.04)}
.selected-flight-airline{display:flex;align-items:center;justify-content:center;padding:15px 12px}.selected-flight-airline img{display:block;width:88px;max-height:58px;object-fit:contain}
.selected-flight-airline-fallback{max-width:95px;overflow:hidden;color:#263ed5;font-size:19px;line-height:1.1;font-weight:900;text-align:center;text-overflow:ellipsis}
.selected-flight-details{min-width:0;padding:12px 18px 9px}.selected-flight-class{margin-bottom:7px;color:#71809b;font-size:10px;line-height:1.2;font-weight:700}.selected-flight-class span{padding:0 4px}
.selected-flight-route{display:grid;grid-template-columns:90px minmax(100px,1fr) 90px;align-items:center;gap:9px}
.selected-flight-point{display:flex;min-width:0;flex-direction:column;gap:1px}.selected-flight-point-right{text-align:right}
.selected-flight-point strong{color:#111c34;font-size:18px;line-height:1.1;font-weight:800}.selected-flight-point span{color:#2c3a51;font-size:12px}.selected-flight-point b{color:#17233d;font-size:12px;font-weight:800}
.selected-flight-duration{display:flex;min-width:0;align-items:center;justify-content:center;gap:7px}.selected-flight-duration>div{height:1px;min-width:16px;flex:1;background:#d8deea}.selected-flight-duration>span{display:inline-flex;flex:0 0 auto;align-items:center;gap:4px;white-space:nowrap;color:#75839a;font-size:10px}.selected-flight-duration svg{width:12px;height:12px}
.selected-flight-info-icons{display:flex;align-items:center;gap:12px;margin-top:7px;color:#8491a8}.selected-flight-info-icons>span{display:grid;width:16px;height:16px;place-items:center;border:1px solid currentColor;border-radius:999px;font-size:9px;font-weight:800}.selected-flight-info-icons svg{width:15px;height:15px}
.selected-flight-price{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 15px;border-left:1px solid #dce3ee;text-align:center}.selected-flight-price>strong{color:#14213c;font-size:21px;line-height:1;font-weight:900}.selected-flight-price>span{margin-top:3px;color:#8994a8;font-size:9px}
.selected-flight-commission{margin-top:7px;padding:5px 11px;border-radius:999px;background:#cdf8da;color:#14843e;font-size:10px;line-height:1;font-weight:800}
.selected-flight-bags{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:8px;color:#27354f}.selected-flight-bags svg{width:18px;height:18px}.selected-flight-bag-x{position:absolute;top:-5px;right:-6px;width:14px!important;height:14px!important;color:#ef4444;stroke-width:3}
.selected-flight-remove{position:absolute;right:6px;bottom:6px;display:grid;width:27px;height:27px;place-items:center;border:0;border-radius:7px;background:transparent;color:#8b98ad;cursor:pointer}.selected-flight-remove:hover{background:#fff0f0;color:#dc2626}.selected-flight-remove svg{width:15px;height:15px}
@media(max-width:900px){.selected-flight-card{grid-template-columns:95px minmax(0,1fr) 155px}.selected-flight-route{grid-template-columns:78px minmax(80px,1fr) 78px}.selected-flight-point strong{font-size:15px}.selected-flight-price>strong{font-size:18px}}
@media(max-width:700px){.selected-flight-heading{align-items:flex-start}.selected-flight-actions button:last-child{display:none}.selected-flight-card{grid-template-columns:78px minmax(0,1fr)}.selected-flight-airline{padding:10px 8px}.selected-flight-airline img{width:64px;max-height:44px}.selected-flight-details{padding:10px 10px 8px}.selected-flight-route{grid-template-columns:1fr auto 1fr;gap:5px}.selected-flight-point strong{font-size:13px}.selected-flight-point span,.selected-flight-point b{font-size:10px}.selected-flight-duration>div{display:none}.selected-flight-price{grid-column:1/-1;flex-direction:row;justify-content:flex-start;gap:8px;padding:8px 12px;border-top:1px solid #dce3ee;border-left:0}.selected-flight-price>span{margin:0}.selected-flight-commission{margin:0 0 0 auto}.selected-flight-bags{margin:0 34px 0 2px}.selected-flight-remove{right:7px;bottom:8px}}
`;

export function SelectedFlightsSummary({
  outbound,
  inbound,
  outboundDate,
  inboundDate,
  onRemove,
  onShowOptions,
}: SelectedFlightsSummaryProps) {
  if (!outbound && !inbound) return null;

  return (
    <>
      <style>{selectedFlightStyles}</style>
      <div className="selected-flights-summary">
      {outbound && (
        <SelectedFlightCard
          direction="out"
          flight={outbound}
          fallbackDate={outboundDate}
          onRemove={onRemove}
          onShowOptions={onShowOptions}
        />
      )}
      {inbound && (
        <SelectedFlightCard
          direction="back"
          flight={inbound}
          fallbackDate={inboundDate}
          onRemove={onRemove}
          onShowOptions={onShowOptions}
        />
      )}
      </div>
    </>
  );
}
