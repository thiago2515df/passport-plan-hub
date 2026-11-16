import { supabase } from "@/integrations/supabase/client";

export async function getValidAccessToken() {
  const current = await supabase.auth.getSession();
  if (current.error) throw current.error;
  if (current.data.session?.access_token) return current.data.session.access_token;

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session?.access_token) {
    throw new Error("Sessão expirada. Entre novamente.");
  }
  return refreshed.data.session.access_token;
}
