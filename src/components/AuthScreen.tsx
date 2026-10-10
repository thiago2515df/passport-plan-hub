import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, Mail, Loader2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/components/AccessProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/excursao-brasilia.png.asset.json";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return <Button variant="ghost" title="Sair" aria-label="Sair" className={compact ? "w-full justify-start px-2 [&_span]:hidden lg:[&_span]:inline" : undefined} disabled={busy} onClick={async () => {
    setBusy(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (!error) await navigate({ to: "/auth", replace: true });
    setBusy(false);
  }}><LogOut className="h-4 w-4" /><span>Sair</span></Button>;
}

export function AuthScreen() {
  const access = useAccess();
  const navigate = useNavigate();
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage("Se o e-mail estiver cadastrado, você receberá um link para definir sua senha.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) { setMessage("Não foi possível entrar. Confira seu e-mail e sua senha e confirme seu acesso pelo e-mail."); return; }
        await navigate({ to: "/pacotes", replace: true });
      }
    } catch { setMessage("Não foi possível concluir. Tente novamente em alguns instantes."); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12 text-foreground"><div className="w-full max-w-sm">
    <img src={logo.url} alt="Excursão Brasília" className="mx-auto mb-10 h-28 w-auto" />
    <div className="mb-7 flex items-center gap-3"><LockKeyhole className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">{forgot ? "Definir senha" : "Entrar no sistema"}</h1></div>
    {access.loading ? <Loader2 aria-label="Verificando acesso" className="mx-auto animate-spin" /> : access.allowed ? <div className="space-y-4"><p>{access.name || "Sua conta"}</p><Button className="w-full" asChild><Link to="/pacotes">Abrir Pacotes</Link></Button>{access.admin && <Button variant="outline" className="w-full" asChild><Link to="/configuracoes">Gerenciar vendedores</Link></Button>}<SignOutButton /></div> : <>
      {access.userId && <div className="mb-5"><p className="mb-3 text-sm text-destructive">Sua conta não tem acesso ativo. Entre em contato com o administrador.</p><SignOutButton /></div>}
      <form onSubmit={submit} className="space-y-5"><label className="block text-sm font-medium">E-mail<Input className="mt-2" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      {!forgot && <label className="block text-sm font-medium">Senha<Input className="mt-2" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      <Button disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : forgot ? <Mail className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}{forgot ? "Enviar link por e-mail" : "Entrar"}</Button>
      <Button variant="ghost" className="w-full" type="button" onClick={() => { setForgot(!forgot); setMessage(""); }}>{forgot ? "Voltar para entrar" : "Esqueci minha senha"}</Button></form>
    </>}
  </div></main>;
}