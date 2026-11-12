// Navegação simples por "#" (funciona em qualquer hospedagem estática, sem configurar redirecionamentos).
import { useEffect, useState } from "react";

function ler(): string[] { return (location.hash || "#hoje").slice(1).split("/").filter(Boolean); }

export function useRota(): string[] {
  const [rota, setRota] = useState(ler);
  useEffect(() => {
    const f = () => { setRota(ler()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return rota.length ? rota : ["hoje"];
}
export function ir(rota: string) {
  if (location.hash === "#" + rota) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = rota;
}
