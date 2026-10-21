import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAccess } from "@/components/AccessProvider";
import { getSellerCommissions } from "@/lib/commissions.functions";

export function useSellerCommissions(ownerId?: string) {
  const access = useAccess();
  const read = useServerFn(getSellerCommissions);
  const userId = ownerId ?? access.userId;
  const query = useQuery({
    queryKey: ["seller-commissions", userId],
    queryFn: () => read({ data: { userId } }),
    enabled: access.allowed && !!userId,
    retry: false,
    staleTime: 0,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  return { ...query, ready: !!query.data?.configured && !query.data.issue && !query.isError };
}
