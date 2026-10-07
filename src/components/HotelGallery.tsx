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

/** Foto de capa; se a busca não trouxe ou a imagem falhar, usa a 1ª foto da ficha do hotel. */
export function HotelPhoto({ hotel }: { hotel: Hotel }) {
  const [broken, setBroken] = useState(false);
  const need = !hotel.image || broken;
  const d = useDetails(hotel.hotelId, need);
  const [idx, setIdx] = useState(0);
  const src = need ? d?.photos[idx] : hotel.image;
  if (!src) return <div className="grid h-36 w-44 place-items-center bg-secondary"><Building2 className="h-8 w-8 text-muted-foreground" /></div>;
  return <img src={src} alt={hotel.name} loading="lazy" onError={() => (need ? setIdx((i) => i + 1) : setBroken(true))} className="h-36 w-44 object-cover" />;
}

export function HotelGallery({ hotel, onClose }: { hotel: Hotel; onClose: () => void }) {
  const d = useDetails(hotel.hotelId);
  const [bad, setBad] = useState<Set<string>>(new Set());
  const photos = (d?.photos.length ? d.photos : hotel.image ? [hotel.image] : []).filter((p) => !bad.has(p));
  const [i, setI] = useState(0);
  const cur = photos[Math.min(i, photos.length - 1)];
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/70 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-4">
          <div><div className="text-lg font-bold">{hotel.name}</div><div className="text-xs text-muted-foreground">{hotel.address}</div></div>
          <button aria-label="Fechar" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="relative grid aspect-video place-items-center overflow-hidden rounded-xl bg-secondary">
          {!d && !cur ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : cur ? <img src={cur} alt={hotel.name} onError={() => setBad((b) => new Set(b).add(cur))} className="h-full w-full object-contain" /> : <span className="text-sm text-muted-foreground">Nenhuma foto disponível</span>}
          {photos.length > 1 && <>
            <button aria-label="Anterior" onClick={() => setI((x) => (x - 1 + photos.length) % photos.length)} className="absolute left-2 rounded-full bg-card/90 p-2"><ChevronLeft className="h-5 w-5" /></button>
            <button aria-label="Próxima" onClick={() => setI((x) => (x + 1) % photos.length)} className="absolute right-2 rounded-full bg-card/90 p-2"><ChevronRight className="h-5 w-5" /></button>
            <span className="absolute bottom-2 right-3 rounded bg-card/90 px-2 text-xs">{Math.min(i, photos.length - 1) + 1}/{photos.length}</span>
          </>}
        </div>
        {photos.length > 1 && <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, k) => <button key={p} onClick={() => setI(k)} className={`shrink-0 overflow-hidden rounded-md border-2 ${k === i ? "border-primary" : "border-transparent"}`}><img src={p} alt="" loading="lazy" onError={() => setBad((b) => new Set(b).add(p))} className="h-16 w-24 object-cover" /></button>)}
        </div>}
        {!!d?.amenities.length && <div className="mt-3 flex flex-wrap gap-1">{d.amenities.slice(0, 20).map((a) => <span key={a} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{a}</span>)}</div>}
        {d?.description && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{d.description}</p>}
      </div>
    </div>
  );
}
