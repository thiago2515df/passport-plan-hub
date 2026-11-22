import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Sparkles, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeFlightImage, analyzeFlightText, analyzeFlightImageWithClaudia, analyzeFlightTextWithClaudia, type FlightImageExtraction } from "@/lib/flight-image.functions";

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
  const claudiaInputRef = useRef<HTMLInputElement>(null);
  const analyze = useServerFn(analyzeFlightImage);
  const analyzeText = useServerFn(analyzeFlightText);
  const analyzeClaudia = useServerFn(analyzeFlightImageWithClaudia);
  const analyzeTextClaudia = useServerFn(analyzeFlightTextWithClaudia);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [textMode, setTextMode] = useState(false);
  const [pastedText, setPastedText] = useState("");

  const processFileWithClaudia = async (file?: File) => {
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
      const result = await analyzeClaudia({ data: { imageDataUrl, directionHint: direction } });
      onImported(result);
      const legs = result.legs.length;
      setMessage(`✓ Claudia identificou ${legs === 1 ? "1 trecho" : `${legs} trechos`}${result.totalPrice != null ? " e o valor total" : ""}. Confira os dados abaixo.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "A Claudia não conseguiu analisar a imagem.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

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


  const processTextWithClaudia = async () => {
    const text = pastedText.trim();
    if (!text) {
      setMessage("Cole a mensagem da cotação ou da passagem.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await analyzeTextClaudia({ data: { text, directionHint: direction } });
      onImported(result);
      const legs = result.legs.length;
      setMessage(`✓ Claudia identificou ${legs === 1 ? "1 trecho" : `${legs} trechos`}${result.totalPrice != null ? " e o valor total" : ""}. Confira os dados abaixo.`);
      setTextMode(false);
      setPastedText("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "A Claudia não conseguiu analisar a mensagem.");
    } finally {
      setBusy(false);
    }
  };

  const processText = async () => {
    const text = pastedText.trim();
    if (!text) {
      setMessage("Cole a mensagem da cotação ou da passagem.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await analyzeText({ data: { text, directionHint: direction } });
      onImported(result);
      const legs = result.legs.length;
      setMessage(`✓ IA identificou ${legs === 1 ? "1 trecho" : `${legs} trechos`}${result.totalPrice != null ? " e o valor total" : ""}. Confira os dados abaixo.`);
      setTextMode(false);
      setPastedText("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível analisar a mensagem.");
    } finally {
      setBusy(false);
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
      <input
        ref={claudiaInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={event => void processFileWithClaudia(event.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="min-h-9 gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/5"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {busy ? "Lendo com IA..." : "Adicionar por imagem"}
          {!busy && <Sparkles className="h-3.5 w-3.5" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => claudiaInputRef.current?.click()}
          className="min-h-9 gap-2 rounded-xl border-violet-300 text-violet-700 hover:bg-violet-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Claudia lendo..." : "Claudia • imagem"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setTextMode(value => !value)}
          className="min-h-9 gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/5"
        >
          <MessageSquareText className="h-4 w-4" />
          Colar mensagem
        </Button>
      </div>
      {textMode && (
        <div className="mt-2 space-y-2">
          <textarea
            value={pastedText}
            onChange={event => setPastedText(event.target.value)}
            placeholder="Cole aqui a mensagem do WhatsApp, e-mail ou texto da cotação/passagem..."
            className="min-h-28 w-full max-w-2xl rounded-xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button type="button" size="sm" disabled={busy || !pastedText.trim()} onClick={() => void processText()} className="rounded-xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Ler mensagem e adicionar voo
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy || !pastedText.trim()} onClick={() => void processTextWithClaudia()} className="ml-2 rounded-xl border-violet-300 text-violet-700 hover:bg-violet-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Ler com Claudia
          </Button>
        </div>
      )}
      {message && (
        <p role="status" className={`mt-1 text-xs ${message.startsWith("✓") ? "text-emerald-700" : "text-muted-foreground"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
