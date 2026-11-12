// Peças de tela da avaliação de pronúncia: botão de falar, frase colorida, detalhe som a som e veredito.
import { useEffect, useRef, useState } from "react";
import * as Pronuncia from "../pronuncia";
import type { PalavraAvaliada, Resultado } from "../pronuncia";
import { calar } from "../lib/voz";

const ROTULO = { ok: "Correto", mid: "Adequado", bad: "Precisa melhorar" } as const;

export function Avaliador({ frase, cls = "", rotulo = "Falar", rotuloDepois, aoResultado }: {
  frase: string; cls?: string; rotulo?: string; rotuloDepois?: string; aoResultado: (r: Resultado) => void;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const [usado, setUsado] = useState(false);
  const tent = useRef<Pronuncia.Tentativa | null>(null);
  const aoRes = useRef(aoResultado);
  aoRes.current = aoResultado;
  useEffect(() => () => { tent.current?.cancelar(); }, []);
  useEffect(() => { setUsado(false); setStatus(""); }, [frase]);

  function iniciar() {
    if (tent.current) { tent.current.parar(); return; }
    calar(); setStatus("");
    const t = Pronuncia.tentar(frase, {
      aoEstado: (e) => {
        if (e.fase === "carregando") { setTexto("Preparando…"); setStatus("Carregando o modelo de pronúncia…"); }
        else if (e.fase === "baixando") { setTexto("Baixando " + (e.pct ?? 0) + "%"); setStatus("Baixando o modelo (" + (e.mb || 355) + " MB). Isso acontece só na primeira vez neste aparelho."); }
        else if (e.fase === "ouvindo") { setTexto("Ouvindo… toque para terminar"); setOuvindo(true); setStatus("Pode falar. Eu paro sozinho quando você terminar."); }
        else if (e.fase === "analisando") { setTexto("Analisando…"); setOuvindo(false); setStatus("Comparando os sons da sua voz com a pronúncia esperada…"); }
      }
    });
    if (Pronuncia.modo() === "rapido") { setTexto("Ouvindo… toque para terminar"); setOuvindo(true); }
    tent.current = t;
    t.promessa.then((r) => { setUsado(true); setStatus(""); aoRes.current(r); })
      .catch((e: Error) => { if (e.message !== "Cancelado.") setStatus(e.message); })
      .finally(() => { tent.current = null; setOuvindo(false); setTexto(null); });
  }
  const disponivel = Pronuncia.disponivel();
  return (
    <>
      <button className={"btn cheio grande " + cls + (ouvindo ? " ouvindo" : "")} type="button" disabled={!disponivel} onClick={iniciar}>
        {texto || (usado ? rotuloDepois || rotulo : rotulo)}
      </button>
      <div className="small muted" aria-live="polite">{status}</div>
    </>
  );
}

export function FrasePintada({ r, tamanho, aoTocar }: { r: Resultado; tamanho?: string; aoTocar?: (p: PalavraAvaliada) => void }) {
  return (
    <div className="frase-en" style={tamanho ? { fontSize: tamanho } : undefined}>
      {r.palavras.map((p, k) => {
        const cls = "w" + (p.nivel === "ok" ? " ok" : p.nivel === "mid" ? " meio" : p.nivel === "bad" ? " miss" : "");
        const tocavel = !!(p.fonemas.length && aoTocar);
        return (
          <span key={k}>
            {k ? " " : ""}
            <span className={cls} role={tocavel ? "button" : undefined} tabIndex={tocavel ? 0 : undefined} style={tocavel ? { cursor: "pointer" } : undefined}
              onClick={tocavel ? () => aoTocar!(p) : undefined} onKeyDown={tocavel ? (e) => { if (e.key === "Enter" || e.key === " ") aoTocar!(p); } : undefined}>{p.texto}</span>
          </span>
        );
      })}
    </div>
  );
}

export function DetalhePalavra({ p }: { p: PalavraAvaliada }) {
  return (
    <div className="detalhe-palavra">
      <div className="between"><b>{p.texto}</b><span className="small muted num">{p.nota}%</span></div>
      <div className="fonemas">
        {p.fonemas.map((f, i) => (
          <span key={i} className={"fonema " + f.nivel} title={f.ouvido ? "Esperado " + f.esperado + ", ouvido " + f.ouvido : "Esperado " + f.esperado + ", não ouvido"}>
            <b>{f.esperado}</b><small>{f.nivel === "ok" ? "✓" : f.ouvido ? f.ouvido : "–"}</small>
          </span>
        ))}
      </div>
      {p.extras.length ? <div className="small muted">Sons a mais: {p.extras.join(" ")}</div> : null}
      <div className="small muted">Em cima, o som esperado. Embaixo, o que o modelo ouviu (✓ = certo, – = faltou).</div>
    </div>
  );
}

export function Veredito({ r }: { r: Resultado }) {
  const total = r.palavras.reduce((s, p) => s + p.fonemas.length, 0);
  const certos = r.palavras.reduce((s, p) => s + p.fonemas.filter((f) => f.nivel === "ok").length, 0);
  return (
    <div className={"resultado " + r.nivel}>
      <div className="veredito"><span>{ROTULO[r.nivel]}</span><span className="num">{r.nota}%</span></div>
      {r.fonte === "local" ? (
        <>
          <div className="small">{certos} de {total} sons corretos. Toque numa palavra colorida para ver som por som.</div>
          {r.dicas.map((d, i) => <div className="dica" key={i}><span className="som">{d.som}</span><span>{d.texto}</span></div>)}
        </>
      ) : <div className="small">O Chrome entendeu: "{r.texto}"</div>}
    </div>
  );
}

// Frase colorida + painel som a som de quem foi tocado.
export function ResultadoFrase({ r, tamanho, dicas = 0 }: { r: Resultado; tamanho?: string; dicas?: number }) {
  const [sel, setSel] = useState<PalavraAvaliada | null>(null);
  useEffect(() => setSel(null), [r]);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <FrasePintada r={r} tamanho={tamanho} aoTocar={setSel} />
      {r.dicas.slice(0, dicas).map((d, i) => <div className="dica" key={i}><span className="som">{d.som}</span><span>{d.texto}</span></div>)}
      {sel ? <DetalhePalavra p={sel} /> : null}
    </div>
  );
}
