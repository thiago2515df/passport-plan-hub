import { useState } from "react";
import latam from "@/assets/latam-logo.png.asset.json";
import gol from "@/assets/gol-logo.png.asset.json";
import azul from "@/assets/azul-logo.png.asset.json";

export function AirlineLogo({ airline }: { airline: string }) {
  const [failed, setFailed] = useState(false);
  const logo = /latam/i.test(airline) ? latam.url : /gol/i.test(airline) ? gol.url : /azul/i.test(airline) ? azul.url : undefined;
  return logo && !failed ? <img src={logo} alt={airline} onError={() => setFailed(true)} className="h-10 w-20 shrink-0 object-contain" /> : <span className="break-words text-sm font-semibold">{airline || "Companhia aérea"}</span>;
}