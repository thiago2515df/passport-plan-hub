import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { setSupabaseAccessCookie } from "@/integrations/supabase/auth-cookie";
import { getAccessClient } from "@/lib/client-dashboard";

const AccessContext = createContext({ userId: "", loading: true, admin: false, allowed: false, name: "" });
export const useAccess = () => useContext(AccessContext);

export function AccessProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [identity, setIdentity] = useState({ id: "", loading: true });
  const access = useQuery({
    queryKey: ["access", identity.id],
    queryFn: () => getAccessClient(identity.id),
    enabled: !!identity.id,
    retry: false,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const [{ data: userData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);
      setSupabaseAccessCookie(sessionData.session?.access_token);
      if (alive) setIdentity({ id: userData.user?.id ?? "", loading: false });
    };
    const { data: subscription } = supabase.auth.onAuthStateChange(event => {
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
      if (event === "SIGNED_OUT") {
        setSupabaseAccessCookie(null);
        setIdentity({ id: "", loading: false });
      }
      else queueMicrotask(refresh);
      router.invalidate();
      if (event !== "SIGNED_OUT") router.options.context?.queryClient.invalidateQueries();
    });
    refresh();
    return () => { alive = false; subscription.subscription.unsubscribe(); };
  }, [router]);
  return <AccessContext.Provider value={{ userId: identity.id, loading: identity.loading || (!!identity.id && access.isPending), admin: access.data?.admin ?? false, allowed: access.data?.allowed ?? false, name: access.data?.profile?.name ?? "" }}>{children}</AccessContext.Provider>;
}