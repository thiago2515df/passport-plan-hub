import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Settings, ShieldCheck, History, Plus, Save, Pencil, Loader2, Search, Plane, FileText, Bus, LockKeyhole, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ManagementNav } from "@/components/ManagementNav";
import { useAccess } from "@/components/AccessProvider";
import { createSeller, getSettings, saveSettings, updateSeller } from "@/lib/settings.functions";
import { decodeProposal } from "@/lib/hotels";

export const Route = createFileRoute("/configuracoes")({ head: () => ({ meta: [
  { title: "Configurações e vendedores — Excursão Brasília" }, { name: "description", content: "Administração de vendedores, permissões e configurações da Excursão Brasília." },
  { name: "robots", content: "noindex, nofollow" },
  { property: "og:title", content: "Configurações — Excursão Brasília" }, { property: "og:description", content: "Gerenciamento de acessos e configurações da agência." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
] }), component: SettingsPage });

const tabs = [{ id: "people", label: "Vendedores", icon: Users }, { id: "agency", label: "Agência", icon: Settings }, { id: "proposals", label: "Propostas", icon: FileText }, { id: "activity", label: "Atividades", icon: History }, { id: "security", label: "Segurança", icon: ShieldCheck }] as const;
const rights = [{ key: "search_hotels", label: "Buscar hotéis", icon: Search }, { key: "search_flights", label: "Buscar voos", icon: Plane }, { key: "create_proposals", label: "Criar propostas", icon: FileText }, { key: "manage_transport", label: "Adicionar transporte", icon: Bus }] as const;
const initial = { id: "", name: "", email: "", phone: "", password: "", active: true, permissions: { search_hotels: true, search_flights: true, create_proposals: true, manage_transport: true } };

function SettingsPage() {
  const access = useAccess();
  const fetchSettings = useServerFn(getSettings);
  const create = useServerFn(createSeller);
  const update = useServerFn(updateSeller);
  const save = useServerFn(saveSettings);
  const settingsQuery = useQuery({ queryKey: ["settings", access.userId], queryFn: () => fetchSettings(), enabled: access.admin, retry: false });
  const data = { ...settingsQuery, data: access.admin ? settingsQuery.data : undefined };
  const [tab, setTab] = useState<string>("people");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(initial);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [agency, setAgency] = useState<{ agency_name: string; whatsapp: string } | null>(null);
  const people = data.data?.people ?? [];
  const sellers = people.filter(p => data.data?.rights.some(r => r.user_id === p.id));
  const agencyValues = agency ?? { agency_name: data.data?.settings?.agency_name ?? "Excursão Brasília", whatsapp: data.data?.settings?.whatsapp ?? "5561992267062" };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      if (form.id) await update({ data: { id: form.id, name: form.name, phone: form.phone, active: form.active, permissions: form.permissions } });
      else await create({ data: { name: form.name, phone: form.phone, email: form.email, password: form.password, permissions: form.permissions } });
      setEditing(false); setForm(initial); setMessage(form.id ? "Vendedor atualizado." : "Conta criada. Confirmação do e-mail e entrada serão concluídas na etapa de login."); await data.refetch();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar."); } finally { setBusy(false); }
  };
  return <div className="min-h-screen bg-background text-foreground"><ManagementNav current="settings" />
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Administração</div><h1 className="text-3xl font-bold">Configurações</h1></div><span className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" />Área do administrador</span></div>
      <div className="mb-8 flex gap-1 overflow-x-auto border-b border-border pb-3">{tabs.map(t => <Button key={t.id} variant={tab === t.id ? "secondary" : "ghost"} onClick={() => setTab(t.id)}><t.icon className="h-4 w-4" />{t.label}</Button>)}</div>
      {message && <p role="status" className="mb-5 rounded-lg border border-border bg-secondary p-3 text-sm">{message}</p>}
      {!access.admin && <div className="mb-8 flex items-start gap-3 border-l-4 border-primary bg-secondary p-5"><LockKeyhole className="mt-1 h-5 w-5 shrink-0" /><div><h2 className="font-semibold">{access.loading ? "Verificando acesso…" : "Acesso administrativo pendente"}</h2><p className="mt-1 text-sm text-muted-foreground">Somente o administrador pode criar vendedores e alterar permissões.</p></div></div>}
      {data.isError && <p className="mb-4 text-destructive">Não foi possível carregar os dados.<Button variant="ghost" onClick={() => data.refetch()}>Tentar novamente</Button></p>}
      {tab === "people" && <section>
        <div className="mb-6 grid grid-cols-3 divide-x divide-border border-y border-border py-5">{[["Vendedores", sellers.length], ["Ativos", sellers.filter(p => p.active).length], ["Suspensos", sellers.filter(p => !p.active).length]].map(([label, count]) => <div key={label} className="px-3"><p className="text-2xl font-bold">{count}</p><p className="text-sm text-muted-foreground">{label}</p></div>)}</div>
        <div className="mb-5 flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">Equipe de vendas</h2><Button disabled={!access.admin} onClick={() => { setForm(initial); setEditing(true); }}><Plus className="h-4 w-4" />Novo vendedor</Button></div>
        <Input aria-label="Buscar vendedor" placeholder="Buscar por nome ou e-mail" value={query} onChange={e => setQuery(e.target.value)} className="mb-4 max-w-sm" />
        {sellers.length === 0 && <div className="border-y border-border py-12 text-center"><Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h3 className="font-semibold">Nenhum vendedor cadastrado</h3></div>}
        <div className="divide-y divide-border">{sellers.filter(p => `${p.name} ${p.email}`.toLowerCase().includes(query.toLowerCase())).map(p => <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{p.name || "Vendedor"}</p><p className="text-sm text-muted-foreground break-all">{p.email} · {p.phone || "Sem telefone"}</p><p className="mt-1 text-xs text-muted-foreground">{data.data?.proposals.filter(x => x.owner_id === p.id).length ?? 0} propostas</p></div><div className="flex items-center gap-4"><span className={p.active ? "text-sm text-primary" : "text-sm text-muted-foreground"}>{p.active ? "Ativo" : "Suspenso"}</span><Button variant="outline" onClick={() => { const r = data.data?.rights.find(x => x.user_id === p.id); setForm({ ...initial, id: p.id, name: p.name, email: p.email, phone: p.phone, active: p.active, permissions: r ? { search_hotels: r.search_hotels, search_flights: r.search_flights, create_proposals: r.create_proposals, manage_transport: r.manage_transport } : initial.permissions }); setEditing(true); }}><Pencil className="h-4 w-4" />Gerenciar</Button></div></div>)}</div>
      </section>}
      {tab === "agency" && <section className="max-w-xl"><h2 className="mb-6 text-xl font-semibold">Dados da agência</h2><form onSubmit={async e => { e.preventDefault(); setBusy(true); try { await save({ data: agencyValues }); setMessage("Configurações salvas."); await data.refetch(); } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar."); } finally { setBusy(false); } }} className="space-y-5"><label className="block text-sm">Nome da agência<Input className="mt-2" required value={agencyValues.agency_name} onChange={e => setAgency({ ...agencyValues, agency_name: e.target.value })} /></label><label className="block text-sm">WhatsApp (com código do país)<Input className="mt-2" required inputMode="tel" pattern="[0-9]{10,15}" value={agencyValues.whatsapp} onChange={e => setAgency({ ...agencyValues, whatsapp: e.target.value.replace(/\D/g, "") })} /></label><Button disabled={!access.admin || busy}><Save className="h-4 w-4" />Salvar alterações</Button></form></section>}
      {tab === "proposals" && <section><h2 className="mb-5 text-xl font-semibold">Propostas da equipe</h2><div className="divide-y divide-border">{data.data?.proposals.map(row => { const p = decodeProposal(row.payload); return <div key={row.code} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{p?.s.cliente || "Cliente"} · {p?.s.destino || "Proposta"}</p><p className="text-sm text-muted-foreground">{people.find(x => x.id === row.owner_id)?.name || "Proposta anterior ao cadastro de vendedores"} · {new Date(row.created_at).toLocaleDateString("pt-BR")}</p></div><Button variant="outline" asChild><a href={`/p/${row.code}`} target="_blank" rel="noreferrer">Ver proposta</a></Button></div>; })}</div>{!data.data?.proposals.length && <p className="py-10 text-muted-foreground">Nenhuma proposta disponível.</p>}</section>}
      {tab === "activity" && <section><h2 className="mb-5 text-xl font-semibold">Histórico de alterações</h2>{data.data?.activities.map(a => <div key={a.id} className="border-b border-border py-4"><p className="font-medium">{a.action}</p><p className="text-sm text-muted-foreground">{people.find(p => p.id === a.actor_id)?.name || "Administrador"}{a.target_id ? ` · ${people.find(p => p.id === a.target_id)?.name || "Vendedor"}` : ""} · {new Date(a.created_at).toLocaleString("pt-BR")}</p></div>)}{!data.data?.activities.length && <p className="py-10 text-muted-foreground">Nenhuma atividade registrada.</p>}</section>}
      {tab === "security" && <section className="max-w-2xl"><h2 className="mb-5 text-xl font-semibold">Controle de acesso</h2>{[["Cadastro de vendedores", "Somente administrador"], ["Visibilidade do vendedor", "Somente as próprias propostas"], ["Página de login", "Próxima etapa"], ["Confirmação de e-mail", "Obrigatória"], ["Integrações", "PassHub · hospedagem e aéreo"], ["Passagens", "Arquivos privados"]].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 border-b border-border py-4"><span>{label}</span><span className="text-sm text-muted-foreground">{value}</span></div>)}</section>}
    </main>
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4"><div role="dialog" aria-modal="true" aria-label={form.id ? "Gerenciar vendedor" : "Novo vendedor"} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg"><div className="mb-6 flex justify-between"><h2 className="text-xl font-semibold">{form.id ? "Gerenciar vendedor" : "Novo vendedor"}</h2><Button variant="ghost" size="icon" aria-label="Fechar" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm">Nome<Input autoFocus required minLength={2} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label className="block text-sm">E-mail<Input type="email" required disabled={!!form.id} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label><label className="block text-sm">Telefone<Input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>{!form.id && <label className="block text-sm">Senha inicial<Input type="password" autoComplete="new-password" required minLength={10} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>}<h3 className="pt-3 font-semibold">Permissões</h3>{rights.map(r => <label key={r.key} className="flex items-center justify-between gap-3 border-b border-border py-2"><span className="flex items-center gap-2 text-sm"><r.icon className="h-4 w-4" />{r.label}</span><Switch checked={form.permissions[r.key]} onCheckedChange={v => setForm({ ...form, permissions: { ...form.permissions, [r.key]: v } })} /></label>)}{form.id && <label className="flex items-center justify-between py-3">Acesso ativo<Switch checked={form.active} onCheckedChange={active => setForm({ ...form, active })} /></label>}<Button className="w-full" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{form.id ? "Salvar vendedor" : "Criar conta"}</Button></form></div></div>}
  </div>;
}