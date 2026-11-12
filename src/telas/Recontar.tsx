// Recontar 4-3-2 (versão para iniciantes 2 · 1,5 · 1 min): a mesma história 3 vezes, com menos tempo.
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { completarPasso, ganharXP, registrarFala } from "../lib/progresso";
import { ouvir, palavras, reconhecimentoDisponivel, type Escuta } from "../lib/voz";
import { hoje } from "../lib/datas";
import { Voltar } from "../componentes/ui";

const TEMPOS = { iniciante: [120, 90, 60], classico: [240, 180, 120] } as const;
type Modo = keyof typeof TEMPOS;
const fmt = (s: number) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");

export function Recontar() {
  const { aulas, atualizar } = useStore();
  const temas = useMemo(() => aulas.flatMap((a) => a.recontar || []), [aulas]);
  const [tema, setTema] = useState(() => temas[Math.floor(Math.random() * temas.length)] || "Conte como foi o seu dia.");
  const [modo, setModo] = useState<Modo>("iniciante");
  const [fase, setFase] = useState<"inicio" | "rodada" | "intervalo" | "final">("inicio");
  const [rodada, setRodada] = useState(0);
  const [wpm, setWpm] = useState<number[]>([]);

  function fimDaRodada(valor: number, segundos: number, qtd: number) {
    const novos = wpm.concat(valor);
    setWpm(novos);
    atualizar((p) => { registrarFala(p, segundos, qtd); return ganharXP(p, 20); });
    if (rodada + 1 < 3) { setRodada(rodada + 1); setFase("intervalo"); return; }
    const ganho = novos[0] ? Math.round((100 * (novos[2] - novos[0])) / novos[0]) : 0;
    atualizar((p) => {
      p.recontar = p.recontar.concat({ data: hoje(), tema, modo, wpm: novos, ganho }).slice(-60);
      const ev = completarPasso(p, "recontar");
      return ganho >= 20 ? ev.concat(ganharXP(p, 20)) : ev;
    });
    setFase("final");
  }

  const Rodadas = () => (
    <div className="rodadas">
      {[0, 1, 2].map((k) => (
        <div key={k} className={"rodada" + (k === rodada && fase !== "final" ? " atual" : "")}>
          <b>{wpm[k] != null ? wpm[k] : "—"}</b><span>palavras/min</span><span>{fmt(TEMPOS[modo][k])}</span>
        </div>
      ))}
    </div>
  );

  if (fase === "rodada") return <Rodada key={rodada} tema={tema} numero={rodada} total={TEMPOS[modo][rodada]} rodadas={<Rodadas />} aoTerminar={fimDaRodada} />;

  if (fase === "intervalo") return (
    <div className="stack-lg">
      <div className="stack"><div className="eyebrow recontar">Respire</div><h2>Agora a mesma história em {fmt(TEMPOS[modo][rodada])}</h2></div>
      <Rodadas />
      <p className="muted">Use as mesmas frases. Tente falar mais solto e cortar as pausas.</p>
      <button className="btn cheio recontar grande" type="button" onClick={() => setFase("rodada")}>Começar a rodada {rodada + 1}</button>
    </div>
  );

  if (fase === "final") {
    const ganho = wpm[0] ? Math.round((100 * (wpm[2] - wpm[0])) / wpm[0]) : 0;
    return (
      <div className="stack-lg">
        <div className="stack"><div className="eyebrow recontar">Resultado</div><h2>{ganho > 0 ? "Você falou " + ganho + "% mais rápido na última rodada" : "Rodadas concluídas"}</h2></div>
        <Rodadas />
        <p className="muted">Ganhar velocidade com o mesmo conteúdo é sinal de fluência. Repita este tema em outro dia e compare.</p>
        <a className="btn cheio recontar" href="#hoje">Voltar para Hoje</a>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <div className="stack">
        <Voltar para="praticar">Praticar</Voltar>
        <div className="eyebrow recontar">Recontar</div>
        <h2>Mesma história, 3 vezes</h2>
        <p className="muted">Você conta a mesma história três vezes, com menos tempo em cada rodada. Como o conteúdo já é conhecido, o cérebro treina velocidade. O app conta quantas palavras por minuto você fala.</p>
      </div>
      <div className="card recontar">
        {temas.length ? (
          <label className="campo" htmlFor="tema-recontar">Tema
            <select id="tema-recontar" value={tema} onChange={(e) => setTema(e.target.value)}>{temas.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </label>
        ) : <p><b>Tema:</b> {tema}</p>}
        <div className="campo">Duração das rodadas
          <div className="seg" role="group" aria-label="Duração">
            {([["iniciante", "2 · 1,5 · 1 min"], ["classico", "4 · 3 · 2 min"]] as const).map(([m, n]) => (
              <button key={m} type="button" aria-pressed={modo === m} onClick={() => setModo(m)}>{n}</button>
            ))}
          </div>
        </div>
        <button className="btn cheio recontar grande" type="button" disabled={!reconhecimentoDisponivel} onClick={() => { setRodada(0); setWpm([]); setFase("rodada"); }}>Começar a rodada 1</button>
        {!reconhecimentoDisponivel ? <p className="small muted">Este exercício precisa do Google Chrome para contar as palavras.</p> : null}
      </div>
    </div>
  );
}

function Rodada({ tema, numero, total, rodadas, aoTerminar }: { tema: string; numero: number; total: number; rodadas: React.ReactNode; aoTerminar: (wpm: number, segundos: number, qtd: number) => void }) {
  const [resta, setResta] = useState(total);
  const [qtd, setQtd] = useState(0);
  const [parcial, setParcial] = useState("");
  const escuta = useRef<Escuta | null>(null);
  const qtdRef = useRef(0);
  const fim = useRef(aoTerminar);
  fim.current = aoTerminar;

  useEffect(() => {
    const inicio = Date.now();
    let vivo = true;
    const e = ouvir({ continuo: true, aoParcial: (t) => { qtdRef.current = palavras(t).length; setQtd(qtdRef.current); setParcial(t.split(" ").slice(-14).join(" ")); } });
    escuta.current = e;
    const timer = window.setInterval(() => {
      const r = total - Math.floor((Date.now() - inicio) / 1000);
      setResta(Math.max(0, r));
      if (r <= 0) { window.clearInterval(timer); e.parar(); }
    }, 250);
    e.promessa.catch(() => ({ texto: "", alternativas: [], segundos: 0 })).then((r) => {
      window.clearInterval(timer);
      if (!vivo) return;
      const usados = Math.max(10, (Date.now() - inicio) / 1000);
      const n = palavras(r.texto).length || qtdRef.current;
      fim.current(Math.round(n / (usados / 60)), usados, n);
    });
    return () => { vivo = false; window.clearInterval(timer); e.parar(); };
  }, [total]);

  return (
    <div className="stack-lg">
      <div className="stack"><div className="eyebrow recontar">Rodada {numero + 1} de 3</div><h2>{tema}</h2></div>
      {rodadas}
      <div className="card recontar">
        <div className="relogio">{fmt(resta)}</div>
        <div className="small muted num" style={{ textAlign: "center" }}>{qtd} palavras</div>
        <div className="parcial">{parcial}</div>
        <button className="btn cheio recontar grande" type="button" onClick={() => escuta.current?.parar()}>Terminar antes</button>
      </div>
    </div>
  );
}
