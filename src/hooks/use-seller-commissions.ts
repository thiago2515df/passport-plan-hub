import { useQuery } from "@tanstack/react-query";
import { useAccess } from "@/components/AccessProvider";
import { supabase } from "@/integrations/supabase/client";
import { commissionSettingsFromRow } from "@/lib/commission-rules";

export function useSellerCommissions(ownerId?: string) {
  const access = useAccess();
  const userId = ownerId ?? access.userId;
  const query = useQuery({
    queryKey: ["seller-commissions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_commissions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return commissionSettingsFromRow(data);
    },
    enabled: access.allowed && !!userId,
    retry: false,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
  return { ...query, ready: !!query.data?.configured && !query.data.issue && !query.isError };
}
