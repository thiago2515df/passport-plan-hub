import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAccess } from "@/lib/settings.functions";

const AccessContext = createContext({ userId: "", loading: true, admin: false, allowed: false, name: "" });
export const useAccess = () => useContext(AccessContext);

export function AccessProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [identity, setIdentity] = useState({ id: "", loading: true });
  const fetchAccess = useServerFn(getAccess);
  const access = useQuery({ queryKey: ["access", identity.id], queryFn: () => fetchAccess(), enabled: !!identity.id, retry: false });
  useEffect(() => {
    let alive = true;
    const refresh = () => { supabase.auth.getUser().then(({ data }) => { if (alive) setIdentity({ id: data.user?.id ?? "", loading: false }); }); };
    const { data: subscription } = supabase.auth.onAuthStateChange(event => {
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
      if (event === "SIGNED_OUT") setIdentity({ id: "", loading: false });
      else queueMicrotask(refresh);
      router.invalidate();
      if (event !== "SIGNED_OUT") router.options.context?.queryClient.invalidateQueries();
    });
    refresh();
    return () => { alive = false; subscription.subscription.unsubscribe(); };
  }, [router]);
  return <AccessContext.Provider value={{ userId: identity.id, loading: identity.loading || (!!identity.id && access.isPending), admin: access.data?.admin ?? false, allowed: access.data?.allowed ?? false, name: access.data?.profile?.name ?? "" }}>{children}</AccessContext.Provider>;
}