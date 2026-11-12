// Shadowing: ouvir uma fala e repetir logo depois, imitando o ritmo. Cada fala recebe nota de pronúncia.
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import type { Aula, Dialogo } from "../lib/tipos";
import { completarPasso, ganharXP, registrarFala, todosBlocos } from "../lib/progresso";
import { calar, falar } from "../lib/voz";
import * as Pronuncia from "../pronuncia";
import type { Resultado } from "../pronuncia";
import { ResultadoFrase } from "../componentes/Pronuncia";
import { ComBlocos, Voltar } from "../componentes/ui";
import { hoje } from "../lib/datas";
import { ir } from "../lib/rota";

type DialogoAula = Dialogo & { aulaTitulo: string };
function todosDialogos(aulas: Aula[]): DialogoAula[] {
  return aulas.flatMap((a) => (a.dialogos || []).map((d) => ({ ...d, aulaTitulo: a.titulo })));
}

export function ListaShadowing() {
  const { perfil, aulas } = useStore();
  const p = perfil!.progresso;
  return (
    <div className="stack-lg">
      <div className="stack">
        <Voltar para="praticar">Praticar</Voltar>
        <div className="eyebrow shadowing">Shadowing</div>
        <h2>Escolha um diálogo</h2>
        <p className="muted">Os trechos marcados em âmbar são blocos prontos que você também revisa nos cartões.</p>
      </div>
      <div className="lista">
        {todosDialogos(aulas).map((d) => {
          const s = p.shadowing[d.id];
          return (
            <a key={d.id} className="item item-btn" href={"#praticar/shadowing/" + d.id} style={{ textDecoration: "none" }}>
              <div className="between"><b>{d.titulo}</b><span className={"pill" + (s ? (s.melhor >= 90 ? " ok" : " mid") : " novo")}>{s ? "melhor " + s.melhor + "%" : "novo"}</span></div>
              <span className="small muted">{d.aulaTitulo} · {d.linhas.length} falas{s ? " · feito " + s.vezes + "x" : ""}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Shadowing({ id }: { id: string }) {
  const { aulas, atualizar } = useStore();
  const d = useMemo(() => todosDialogos(aulas).find((x) => x.id === id), [aulas, id]);
  const blocos = useMemo(() => todosBlocos(aulas), [aulas]);
  const [velocidade, setVelocidade] = useState(0.8);
  const [esconder, setEsconder] = useState(false);
  const [ativa, setAtiva] = useState<number | null>(null);
  const [notas, setNotas] = useState<(Resultado | null)[]>(() => (d ? d.linhas.map(() => null) : []));
  const [status, setStatus] = useState("");
  const parar = useRef(false);
  const escuta = useRef<Pronuncia.Tentativa | null>(null);
  const vel = useRef(velocidade);
  vel.current = velocidade;
  const concluido = useRef(false);
  const notasRef = useRef(notas);

  useEffect(() => () => { parar.current = true; escuta.current?.cancelar(); calar(); }, []);
  useEffect(() => { if (!d) ir("praticar/shadowing"); }, [d]);
  if (!d) return null;
  const dialogo = d;
  const disponivel = Pronuncia.disponivel();

  function verificarFim() {
    const ns = notasRef.current;
    if (concluido.current || ns.some((n) => !n)) return;
    concluido.current = true;
    const media = Math.round(ns.reduce((s, n) => s + n!.nota, 0) / ns.length);
    atualizar((p) => {
      const s = p.shadowing[dialogo.id] || { vezes: 0, melhor: 0 };
      s.vezes += 1; s.melhor = Math.max(s.melhor, media); s.ultima = hoje();
      p.shadowing[dialogo.id] = s;
      return completarPasso(p, "shadowing").concat(ganharXP(p, 20));
    });
    setStatus("Diálogo completo. Média " + media + "%. Faça de novo mais rápido ou escondendo o inglês.");
  }

  async function repetirLinha(k: number) {
    if (escuta.current) return;
    setAtiva(k);
    await falar(dialogo.linhas[k].en, vel.current);
    if (parar.current) return;
    setStatus("Sua vez: repita a fala " + (k + 1));
    const t = Pronuncia.tentar(dialogo.linhas[k].en, {
      aoEstado: (e) => {
        if (e.fase === "baixando") setStatus("Baixando o modelo de pronúncia: " + e.pct + "% (só na primeira vez)");
        else if (e.fase === "carregando") setStatus("Preparando o modelo de pronúncia…");
        else if (e.fase === "ouvindo") setStatus("Sua vez: repita a fala " + (k + 1) + ". Eu paro sozinho quando você terminar.");
        else if (e.fase === "analisando") setStatus("Analisando os sons…");
      }
    });
    escuta.current = t;
    try {
      const r = await t.promessa;
      notasRef.current = notasRef.current.map((n, j) => (j === k ? r : n));
      setNotas(notasRef.current);
      atualizar((p) => {
        registrarFala(p, r.segundos || 2, r.qtdPalavras || 0);
        p.totais.linhasShadow += 1;
        return r.nivel !== "bad" ? ganharXP(p, 5) : [];
      });
      setStatus("");
    } catch (e) { if ((e as Error).message !== "Cancelado.") setStatus((e as Error).message); }
    escuta.current = null;
    verificarFim();
  }
  async function automatico() {
    parar.current = false;
    for (let k = 0; k < dialogo.linhas.length && !parar.current; k++) await repetirLinha(k);
  }
  async function ouvirTudo() {
    parar.current = false;
    for (let k = 0; k < dialogo.linhas.length && !parar.current; k++) { setAtiva(k); await falar(dialogo.linhas[k].en, vel.current); await pausa(350); }
    setAtiva(null);
  }

  return (
    <div className="stack-lg">
      <div className="stack">
        <Voltar para="praticar/shadowing">Diálogos</Voltar>
        <div className="eyebrow shadowing">Shadowing · {dialogo.aulaTitulo}</div>
        <h2>{dialogo.titulo}</h2>
        <p className="muted small">1. Ouça tudo uma vez. 2. Use o modo automático: o app fala cada frase e você repete logo depois, imitando o ritmo. 3. Repita escondendo o inglês.</p>
      </div>
      <div className="etapas" role="group" aria-label="Velocidade">
        {([[0.6, "Devagar"], [0.8, "Médio"], [0.95, "Normal"]] as const).map(([v, n]) => (
          <button key={v} className="etapa" type="button" aria-pressed={velocidade === v} onClick={() => setVelocidade(v)}>{n}</button>
        ))}
        <button className="etapa" type="button" aria-pressed={esconder} onClick={() => setEsconder((x) => !x)}>Esconder inglês</button>
      </div>
      <div className="row">
        <button className="btn" type="button" onClick={ouvirTudo}>▶ Ouvir tudo</button>
        {disponivel ? <button className="btn cheio shadowing" type="button" onClick={automatico}>Ouvir e repetir (automático)</button> : null}
        <button className="btn fantasma" type="button" onClick={() => { parar.current = true; calar(); escuta.current?.parar(); }}>Parar</button>
      </div>
      <div className="small muted" aria-live="polite">{status}</div>
      <div className="linhas">
        {dialogo.linhas.map((l, k) => {
          const nota = notas[k];
          return (
            <div key={k} className={"linha" + (k === ativa ? " ativa" : "")}>
              <div className={"quem " + l.quem}>{l.quem}</div>
              <div className="stack" style={{ gap: 4 }}>
                <div className="en">{esconder && k !== ativa ? "• • •" : <ComBlocos texto={l.en} blocos={blocos} />}</div>
                <div className="pt">{l.pt}</div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn fantasma small" type="button" onClick={() => falar(l.en, velocidade)}>▶ Ouvir</button>
                  {disponivel ? <button className="btn fantasma small" type="button" onClick={() => { parar.current = false; repetirLinha(k); }}>Repetir</button> : null}
                  {nota ? <span className="nota" style={{ color: "var(--" + nota.nivel + ")" }}>{nota.nota}%</span> : null}
                </div>
                {nota ? <ResultadoFrase r={nota} tamanho="1.05rem" dicas={1} /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
