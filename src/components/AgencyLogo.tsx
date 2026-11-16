import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgencyContact } from "@/lib/settings.functions";

type Props = {
  className?: string;
  logoUrl?: string | null;
  alt?: string;
};

export function AgencyLogo({ className = "h-16 w-16", logoUrl, alt = "Excursão Brasília" }: Props) {
  const contact = useServerFn(getAgencyContact);
  const query = useQuery({
    queryKey: ["agency-brand"],
    queryFn: () => contact(),
    staleTime: 5 * 60_000,
    enabled: !logoUrl,
    retry: false,
  });

  const src = logoUrl || query.data?.logo_url || "/favicon.png";

  return (
    <span className={`inline-flex shrink-0 overflow-hidden rounded-full bg-white ${className}`}>
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </span>
  );
}
