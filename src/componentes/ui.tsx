import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Bloco, Conversa } from "../lib/tipos";
import { dataBR } from "../lib/datas";

const ICONES: Record<string, ReactNode> = {
  hoje: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>,
  conversar: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>,
  praticar: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.5" /></>,
  progresso: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  aulas: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21V5" /><path d="M9 8h6" /></>,
  blocos: <><rect x="3" y="6" width="13" height="13" rx="2" /><path d="M8 3h11a2 2 0 0 1 2 2v11" /></>,
  shadowing: <path d="M3 10v4M7 7v10M11 4v16M15 8v8M19 11v2" />,
  recontar: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6" /></>
};
export function Icone({ nome }: { nome: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONES[nome]}</svg>;
}

export const CORES_PERFIL = ["#5e2257", "#2a64a8", "#187a62", "#b86a00", "#b3261e", "#6b4bb8"];

export function Avatar({ nome, cor, grande }: { nome: string; cor: string; grande?: boolean }) {
  return <span className={"avatar" + (grande ? " grande" : "")} style={{ background: cor }}>{nome.charAt(0).toUpperCase()}</span>;
}

export function Metrica({ valor, rotulo }: { valor: ReactNode; rotulo: string }) {
  return <div className="metrica"><b>{valor}</b><span>{rotulo}</span></div>;
}

export function Voltar({ para, children }: { para: string; children: ReactNode }) {
  return <a className="btn fantasma" href={"#" + para} style={{ justifySelf: "start" }}>← {children}</a>;
}

// Botão que pede um segundo toque para confirmar.
export function BotaoConfirmar({ rotulo, confirmar, acao }: { rotulo: string; confirmar: string; acao: () => void }) {
  const [armado, setArmado] = useState(false);
  const t = useRef<number | null>(null);
  useEffect(() => () => { if (t.current) window.clearTimeout(t.current); }, []);
  return (
    <button className="btn" type="button" style={armado ? { color: "var(--bad)" } : undefined} onClick={() => {
      if (armado) { acao(); return; }
      setArmado(true);
      t.current = window.setTimeout(() => setArmado(false), 4000);
    }}>{armado ? confirmar : rotulo}</button>
  );
}

// Botão que vira "Salvo" depois de usado.
export function BotaoUmaVez({ rotulo, feito, acao, className = "btn" }: { rotulo: string; feito: string; acao: () => void; className?: string }) {
  const [ok, setOk] = useState(false);
  return <button className={className} type="button" disabled={ok} onClick={() => { acao(); setOk(true); }}>{ok ? feito : rotulo}</button>;
}

export function CartaoConversa({ c }: { c: Conversa }) {
  return (
    <div className="item">
      <div className="between"><b>{c.titulo}</b><span className="small muted">{dataBR(c.data)}</span></div>
      <span className="small muted">{c.turnos} falas · {c.palavras} palavras{c.fluencia ? " · fluência " + c.fluencia + "/5" : ""}</span>
      {(c.correcoes || []).slice(0, 2).map((k, i) => (
        <div className="correcao" key={i}><span className="disse">{k.said}</span><span className="melhor">{k.better}</span></div>
      ))}
    </div>
  );
}

// Destaca, dentro de um texto, os blocos prontos que aparecem nele.
export function ComBlocos({ texto, blocos }: { texto: string; blocos: Bloco[] }) {
  const alvos = blocos.map((b) => b.en.replace(/[.?!]+$/, "").replace(/_{2,}.*$/, "").trim()).filter((t) => t.split(" ").length >= 2).sort((a, b) => b.length - a.length);
  const partes: ReactNode[] = [];
  let resto = texto, k = 0;
  while (resto) {
    let melhor: { pos: number; len: number } | null = null;
    for (const bl of alvos) {
      const pos = resto.toLowerCase().indexOf(bl.toLowerCase());
      if (pos >= 0 && (!melhor || pos < melhor.pos || (pos === melhor.pos && bl.length > melhor.len))) melhor = { pos, len: bl.length };
    }
    if (!melhor) { partes.push(resto); break; }
    if (melhor.pos) partes.push(resto.slice(0, melhor.pos));
    partes.push(<span className="chunk" key={k++}>{resto.slice(melhor.pos, melhor.pos + melhor.len)}</span>);
    resto = resto.slice(melhor.pos + melhor.len);
  }
  return <>{partes}</>;
}
