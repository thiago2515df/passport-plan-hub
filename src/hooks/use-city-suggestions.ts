import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchDestinations } from "@/lib/passhub.functions";

type City = { id: string; name: string; type: string };
type Result = { items: City[]; error?: string };
const cache = new Map<string, City[]>();
const pending = new Map<string, Promise<Result>>();

export function useCitySuggestions(query: string) {
  const search = useServerFn(searchDestinations);
  const [state, setState] = useState<{ query: string; items: City[]; loading: boolean; error: string }>({ query: "", items: [], loading: false, error: "" });
  const text = query.trim().slice(0, 80);
  useEffect(() => {
    if (text.length < 3) return;
    let current = true;
    const key = text.toLocaleLowerCase("pt-BR");
    const saved = cache.get(key);
    if (saved) {
      setState({ query: text, items: saved, loading: false, error: "" });
      return;
    }
    setState({ query: text, items: [], loading: true, error: "" });
    const timer = setTimeout(async () => {
      try {
        let request = pending.get(key);
        if (!request) {
          request = search({ data: { q: text } });
          pending.set(key, request);
          request.finally(() => pending.delete(key)).catch(() => {});
        }
        const result = await request;
        const items = result.items.slice(0, 8);
        if (!result.error) {
          if (cache.size >= 100) cache.clear();
          cache.set(key, items);
        }
        if (current) setState({ query: text, items, loading: false, error: result.error ? "Não foi possível buscar as cidades. Tente novamente." : "" });
      } catch {
        if (current) setState({ query: text, items: [], loading: false, error: "Não foi possível buscar as cidades. Tente novamente." });
      }
    }, 120);
    return () => { current = false; clearTimeout(timer); };
  }, [text, search]);
  return text.length >= 3 && state.query === text ? state : { items: [], loading: text.length >= 3, error: "" };
}