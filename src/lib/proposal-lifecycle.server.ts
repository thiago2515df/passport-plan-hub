import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;
const ARCHIVE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

type LifecycleRow = {
  code: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  updated_at: string;
};

export type ProposalLifecycleState = "active" | "approved" | "expired" | "cancelled" | "missing";

const deadlineFor = (row: Pick<LifecycleRow, "status" | "created_at" | "sent_at">) => {
  const base = row.status === "awaiting" && row.sent_at ? row.sent_at : row.created_at;
  return new Date(base).getTime() + PROPOSAL_TTL_MS;
};

const shouldExpire = (row: LifecycleRow, now: number) =>
  (row.status === "created" || row.status === "awaiting") && deadlineFor(row) <= now;

const purgeCancelled = async (rows: LifecycleRow[], now: number) => {
  const cutoff = now - ARCHIVE_RETENTION_MS;
  const purgeCodes = rows
    .filter(row => row.status === "cancelled" && new Date(row.updated_at).getTime() <= cutoff)
    .map(row => row.code);

  if (!purgeCodes.length) return;
  await supabaseAdmin.from("proposal_acceptances").delete().in("code", purgeCodes);
  await supabaseAdmin.from("proposals").delete().in("code", purgeCodes);
};

/**
 * Aplica as regras automáticas do quadro:
 * - propostas criadas/enviadas expiram após 24h sem aprovação;
 * - expiradas viram canceladas e passam a ser tratadas como arquivo;
 * - canceladas são eliminadas definitivamente após 30 dias.
 */
export async function maintainProposalLifecycle() {
  const now = Date.now();
  const { data, error } = await supabaseAdmin
    .from("proposals")
    .select("code,status,created_at,sent_at,updated_at")
    .in("status", ["created", "awaiting", "cancelled"]);

  if (error) throw new Error("Não foi possível atualizar o ciclo de vida das propostas.");
  const rows = (data ?? []) as LifecycleRow[];
  const expiredCodes = rows.filter(row => shouldExpire(row, now)).map(row => row.code);

  if (expiredCodes.length) {
    const { error: updateError } = await supabaseAdmin
      .from("proposals")
      .update({ status: "cancelled" })
      .in("code", expiredCodes);
    if (updateError) throw new Error("Não foi possível vencer as propostas antigas.");
  }

  await purgeCancelled(rows, now);
}

/** Valida uma proposta pública e, se necessário, expira/purga apenas esse código. */
export async function getProposalLifecycleState(code: string) {
  const { data, error } = await supabaseAdmin
    .from("proposals")
    .select("code,status,created_at,sent_at,updated_at")
    .eq("code", code)
    .maybeSingle();

  if (error) throw new Error("Não foi possível validar a proposta.");
  if (!data) return { state: "missing" as ProposalLifecycleState, expiresAt: null };

  const row = data as LifecycleRow;
  const now = Date.now();

  if (row.status === "approved") {
    return { state: "approved" as ProposalLifecycleState, expiresAt: null };
  }

  if (row.status === "cancelled") {
    if (new Date(row.updated_at).getTime() <= now - ARCHIVE_RETENTION_MS) {
      await supabaseAdmin.from("proposal_acceptances").delete().eq("code", code);
      await supabaseAdmin.from("proposals").delete().eq("code", code);
      return { state: "missing" as ProposalLifecycleState, expiresAt: null };
    }
    return { state: "cancelled" as ProposalLifecycleState, expiresAt: null };
  }

  const expiresAt = new Date(deadlineFor(row)).toISOString();
  if (shouldExpire(row, now)) {
    await supabaseAdmin.from("proposals").update({ status: "cancelled" }).eq("code", code);
    return { state: "expired" as ProposalLifecycleState, expiresAt };
  }

  return { state: "active" as ProposalLifecycleState, expiresAt };
}
