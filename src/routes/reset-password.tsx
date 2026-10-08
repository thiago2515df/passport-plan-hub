import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/excursao-brasilia.png.asset.json";

export const Route = createFileRoute("/reset-password")({ head: () => ({ meta: [{ title: "Definir senha — Excursão Brasília" }, { name: "description", content: "Defina sua senha de acesso à Excursão Brasília." }, { property: "og:title", content: "Definir senha — Excursão Brasília" }, { property: "og:description", content: "Ativação e recuperação de acesso da equipe." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }), component: ResetPassword });
function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    async function verify() {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const params = new URLSearchParams(window.location.search);
      const type = hash.get("type") ?? params.get("type");
      let valid = false;
      if (type === "recovery" || type === "invite") {
        const tokenHash = params.get("token_hash");
        const accessToken = hash.get("access_token"), refreshToken = hash.get("refresh_token");
        if (tokenHash) { const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }); valid = !error; }
        else if (accessToken && refreshToken) { const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }); valid = !error; }
        if (valid) { const { data } = await supabase.auth.getUser(); valid = !!data.user; }
      }
      window.history.replaceState(null, "", window.location.pathname);
      if (alive) { setReady(valid); setChecking(false); if (!valid) setMessage("Este link é inválido ou expirou. Solicite outro na página de entrada."); }
    }
    void verify(); return () => { alive = false; };
  }, []);
  return <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12"><div className="w-full max-w-sm"><img src={logo.url} alt="Excursão Brasília" className="mx-auto mb-10 h-28 w-auto" /><h1 className="mb-7 text-2xl font-bold">Definir minha senha</h1>
    {checking ? <Loader2 aria-label="Verificando link" className="animate-spin" /> : <form className="space-y-5" onSubmit={async e => {
      e.preventDefault(); if (!ready || busy) return;
      if (password !== confirm) { setMessage("As senhas precisam ser iguais."); return; }
      setBusy(true); setMessage("");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setMessage("Não foi possível salvar. Use uma senha forte com pelo menos 10 caracteres e tente novamente."); setBusy(false); return; }
      await navigate({ to: "/pacotes", replace: true });
    }}>{ready && <><label className="block text-sm">Nova senha<Input className="mt-2" type="password" autoComplete="new-password" required minLength={10} value={password} onChange={e => setPassword(e.target.value)} /></label><label className="block text-sm">Confirmar senha<Input className="mt-2" type="password" autoComplete="new-password" required minLength={10} value={confirm} onChange={e => setConfirm(e.target.value)} /></label><Button className="w-full" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}Salvar senha</Button></>}{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}<Button variant="ghost" type="button" onClick={() => navigate({ to: "/auth" })}>Voltar para entrar</Button></form>}
  </div></main>;
}