import { useState } from "react";
import { LATAM_LOGO, GOL_LOGO, AZUL_LOGO } from "@/lib/airline-logos";

export function AirlineLogo({ airline }: { airline: string }) {
  const [failed, setFailed] = useState(false);
  const key = airline.trim();
  const logo = /latam|\bLA\b|\bJJ\b/i.test(key) ? LATAM_LOGO : /gol|\bG3\b/i.test(key) ? GOL_LOGO : /azul|\bAD\b/i.test(key) ? AZUL_LOGO : undefined;
  return logo && !failed ? <img src={logo} alt={airline} onError={() => setFailed(true)} className="h-10 w-20 shrink-0 object-contain" /> : <span className="break-words text-sm font-semibold">{airline || "Companhia aérea"}</span>;
}