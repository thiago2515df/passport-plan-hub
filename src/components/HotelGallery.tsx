import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { getHotelDetails } from "@/lib/passhub.functions";
import type { Hotel } from "@/lib/hotels";

type Details = { photos: string[]; description: string; amenities: string[] };
const cache = new Map<number, Promise<Details>>();

function useDetails(hotelId?: number, enabled = true) {
  const fn = useServerFn(getHotelDetails);
  const [d, setD] = useState<Details | null>(null);
  useEffect(() => {
    if (!hotelId || !enabled) return;
    if (!cache.has(hotelId)) cache.set(hotelId, fn({ data: { hotelId } }).catch(() => ({ photos: [], description: "", amenities: [] })));
    let on = true;
    cache.get(hotelId)!.then((r) => on && setD(r));
    return () => { on = false; };
  }, [hotelId, enabled]);
  return d;
}

const decodeEntities = (value: string) => value
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">");

function formatDescription(raw: string) {
  const normalized = decodeEntities(raw)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|section|li|h[1-6])\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const knownTitles = /^(Localização do estabelecimento|Localização|Quartos|Comodidades|Alimentação|Restaurantes|Serviços|Lazer|Sobre o hotel|Informações importantes|Políticas|Taxas)(?:\s*[:\-–—]?\s*)(.*)$/i;
  const blocks = normalized.split(/\n+/).map(x => x.trim()).filter(Boolean);
  const sections: { title?: string; text: string }[] = [];
  for (const block of blocks) {
    const match = block.match(knownTitles);
    if (match) {
      const title = match[1]?.trim();
      const text = match[2]?.trim() ?? "";
      sections.push({ ...(title ? { title } : {}), text });
    } else if (sections.length && !sections[sections.length - 1]!.text) {
      sections[sections.length - 1]!.text = block;
    } else {
      sections.push({ text: block });
    }
  }
  return sections;
}

export function HotelPhoto({ hotel }: { hotel: Hotel }) {
  const [broken, setBroken] = useState(false);
  const apiImages = hotel.images ?? [];
  const needPasshub = hotel.provider !== "airbnb" && (!hotel.image || broken);
  const d = useDetails(hotel.hotelId, needPasshub);
  const [idx, setIdx] = useState(0);
  const candidates = hotel.provider === "airbnb" ? [hotel.image, ...apiImages].filter(Boolean) : (needPasshub ? d?.photos ?? [] : [hotel.image]);
  const src = candidates[idx];
  if (!src) return <div className="grid h-36 w-44 place-items-center bg-secondary"><Building2 className="h-8 w-8 text-muted-foreground" /></div>;
  return <img src={src} alt={hotel.name} loading="lazy" onError={() => setIdx((i) => i + 1)} className="h-36 w-44 object-cover" />;
}

export function HotelGallery({ hotel, onClose }: { hotel: Hotel; onClose: () => void }) {
  const d = useDetails(hotel.hotelId, hotel.provider !== "airbnb");
  const [bad, setBad] = useState<Set<string>>(new Set());
  const sourcePhotos = hotel.provider === "airbnb"
    ? [hotel.image, ...(hotel.images ?? [])].filter(Boolean)
    : (d?.photos.length ? d.photos : hotel.image ? [hotel.image] : []);
  const photos = Array.from(new Set(sourcePhotos)).filter((p) => !bad.has(p));
  const [i, setI] = useState(0);
  const cur = photos[Math.min(i, photos.length - 1)];
  const description = d?.description ? formatDescription(d.description) : [];

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => (x + 1) % Math.max(1, photos.length));
      if (e.key === "ArrowLeft") setI((x) => (x - 1 + photos.length) % Math.max(1, photos.length));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [photos.length]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/70 p-0 sm:place-items-center sm:p-4" onClick={onClose}>
      <div className="h-[100dvh] max-h-[100dvh] w-full max-w-4xl overflow-y-auto overscroll-contain bg-card p-3 shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:p-4" onClick={(e) => e.stopPropagation()}>
        <div className="sticky -top-3 z-10 -mx-3 -mt-3 mb-3 flex items-start justify-between gap-3 border-b border-border bg-card/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:mt-0 sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0">
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-foreground sm:text-lg">{hotel.name}</div>
            <div className="truncate text-[11px] text-muted-foreground sm:text-xs">{hotel.address}</div>
          </div>
          <button aria-label="Fechar" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary hover:bg-secondary/80"><X className="h-5 w-5" /></button>
        </div>

        <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-secondary sm:aspect-video">
          {hotel.provider !== "airbnb" && !d && !cur ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : cur ? <img src={cur} alt={hotel.name} onError={() => setBad((b) => new Set(b).add(cur))} className="h-full w-full object-cover sm:object-contain" /> : <span className="text-sm text-muted-foreground">Nenhuma foto disponível</span>}
          {photos.length > 1 && <>
            <button aria-label="Anterior" onClick={() => setI((x) => (x - 1 + photos.length) % photos.length)} className="absolute left-2 grid h-9 w-9 place-items-center rounded-full bg-card/90 shadow"><ChevronLeft className="h-5 w-5" /></button>
            <button aria-label="Próxima" onClick={() => setI((x) => (x + 1) % photos.length)} className="absolute right-2 grid h-9 w-9 place-items-center rounded-full bg-card/90 shadow"><ChevronRight className="h-5 w-5" /></button>
            <span className="absolute bottom-2 right-3 rounded bg-card/90 px-2 py-0.5 text-xs">{Math.min(i, photos.length - 1) + 1}/{photos.length}</span>
          </>}
        </div>

        {photos.length > 1 && <div className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1">
          {photos.map((p, k) => <button key={p} onClick={() => setI(k)} className={`shrink-0 snap-start overflow-hidden rounded-md border-2 ${k === i ? "border-primary" : "border-transparent"}`}><img src={p} alt="" loading="lazy" onError={() => setBad((b) => new Set(b).add(p))} className="h-14 w-20 object-cover sm:h-16 sm:w-24" /></button>)}
        </div>}

        {!!d?.amenities.length && (
          <section className="mt-3 border-t border-border pt-3 sm:mt-4 sm:pt-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Comodidades</h3>
            <div className="flex flex-wrap gap-1.5">
              {d.amenities.slice(0, 20).map((a) => <span key={a} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-foreground sm:text-xs">{a}</span>)}
            </div>
          </section>
        )}

        {!!description.length && (
          <section className="mt-3 border-t border-border pt-3 sm:mt-4 sm:pt-4">
            <h3 className="mb-3 text-base font-bold text-foreground">Sobre a hospedagem</h3>
            <div className="space-y-3">
              {description.map((part, index) => (
                <div key={`${part.title ?? "texto"}-${index}`}>
                  {part.title && <h4 className="mb-1 text-sm font-semibold text-foreground">{part.title}</h4>}
                  {part.text && <p className="text-[13px] leading-5 text-muted-foreground sm:text-sm sm:leading-6">{part.text}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
