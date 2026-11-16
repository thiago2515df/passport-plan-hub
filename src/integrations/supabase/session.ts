import { supabase } from "@/integrations/supabase/client";

const PROJECT_REF = "qsezhcorqurhtxfhcqxq";

function tokenFromLocalStorage(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(`sb-${PROJECT_REF}-auth-token`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return parsed?.access_token
      ?? parsed?.currentSession?.access_token
      ?? parsed?.session?.access_token
      ?? undefined;
  } catch {
    return undefined;
  }
}

export async function getValidAccessToken() {
  const current = await supabase.auth.getSession();
  if (current.data.session?.access_token) return current.data.session.access_token;

  const stored = tokenFromLocalStorage();
  if (stored) return stored;

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.data.session?.access_token) return refreshed.data.session.access_token;

  const storedAfterRefresh = tokenFromLocalStorage();
  if (storedAfterRefresh) return storedAfterRefresh;

  throw new Error("Não foi possível recuperar a sessão ativa. Saia e entre novamente.");
}
