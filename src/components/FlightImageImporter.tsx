import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeFlightImage, type FlightImageExtraction } from "@/lib/flight-image.functions";

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
  reader.onload = () => resolve(String(reader.result ?? ""));
  reader.readAsDataURL(file);
});

export function FlightImageImporter({
  direction,
  onImported,
}: {
  direction: "out" | "back";
  onImported: (data: FlightImageExtraction) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const analyze = useServerFn(analyzeFlightImage);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const processFile = async (file?: File) => {
    if (!file) return;
    setMessage("");
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setMessage("Use uma imagem PNG, JPG ou WebP.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setMessage("A imagem deve ter no máximo 6 MB.");
      return;
    }
    setBusy(true);
    try {
      const imageDataUrl = await readAsDataUrl(file);
      const result = await analyze({ data: { imageDataUrl, directionHint: direction } });
      onImported(result);
      const legs = result.legs.length;
      setMessage(`✓ IA identificou ${legs === 1 ? "1 trecho" : `${legs} trechos`}${result.totalPrice != null ? " e o valor total" : ""}. Confira os dados abaixo.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível analisar a imagem.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={event => void processFile(event.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="min-h-9 gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/5"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        {busy ? "Lendo imagem com IA..." : "Adicionar voo por imagem"}
        {!busy && <Sparkles className="h-3.5 w-3.5" />}
      </Button>
      {message && (
        <p role="status" className={`mt-1 text-xs ${message.startsWith("✓") ? "text-emerald-700" : "text-muted-foreground"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
