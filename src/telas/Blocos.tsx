// Blocos prontos com repetição espaçada: vê em português, fala em inglês, o app avalia a pronúncia.
import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import type { Bloco, Nivel } from "../lib/tipos";
import { completarPasso, estadoCartao, filaDoDia, ganharXP, registrarFala, revisarCartao } from "../lib/progresso";
import { falar } from "../lib/voz";
import * as Pronuncia from "../pronuncia";
import type { Resultado } from "../pronuncia";
import { Avaliador, ResultadoFrase, Veredito } from "../componentes/Pronuncia";
import { Voltar } from "../componentes/ui";

export function Blocos() {
  const { perfil, aulas, atualizar } = useStore();
  const [fila] = useState(() => filaDoDia(perfil!.progresso, aulas, 5).slice(0, 15));
  const [i, setI] = useState(0);
  const [placar, setPlacar] = useState({ feitos: 0, acertos: 0 });
  const concluiu = useRef(false);
  useEffect(() => {
    if (i < fila.length || concluiu.current) return;
    concluiu.current = true;
    if (placar.feitos >= Math.min(5, fila.length) || !fila.length) atualizar((p) => completarPasso(p, "blocos"));
  }, [i, fila.length, placar.feitos, atualizar]);

  if (i >= fila.length) {
    return (
      <div className="card blocos">
        <div className="eyebrow blocos">Blocos prontos</div>
        <h2>{fila.length ? "Revisão concluída" : "Tudo em dia"}</h2>
        <p className="muted">{fila.length ? placar.feitos + " frases faladas, " + placar.acertos + " corretas. As que você errou voltam ainda hoje ou amanhã." : "Não há frases para revisar agora. Novas frases entram quando vocês adicionam uma aula ou salvam frases das conversas."}</p>
        <div className="row"><a className="btn cheio blocos" href="#hoje">Voltar para Hoje</a><a className="btn" href="#conversar/diario">Usar na conversa</a></div>
      </div>
    );
  }

  const b = fila[i];
  return (
    <div className="stack-lg">
      <div className="between"><Voltar para="praticar">Sair</Voltar><span className="small muted num">{i + 1} de {fila.length}</span></div>
      <div className="barra"><span style={{ width: Math.round((100 * i) / fila.length) + "%", background: "var(--blocos)" }} /></div>
      <CartaoBloco key={b.id} b={b} estado={estadoCartao(perfil!.progresso, b.id)}
        aoRegistrar={(nivel, nota, r) => {
          atualizar((p) => {
            if (r) registrarFala(p, r.segundos || 2, r.qtdPalavras || 0);
            revisarCartao(p, b.id, nivel, nota);
            return ganharXP(p, nivel === "ok" ? 10 : nivel === "mid" ? 6 : 2);
          });
          setPlacar((s) => ({ feitos: s.feitos + 1, acertos: s.acertos + (nivel === "ok" ? 1 : 0) }));
        }}
        aoProxima={() => setI((x) => x + 1)} />
    </div>
  );
}

function CartaoBloco({ b, estado, aoRegistrar, aoProxima }: { b: Bloco; estado: string; aoRegistrar: (n: Nivel, nota: number, r?: Resultado) => void; aoProxima: () => void }) {
  const [revelado, setRevelado] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [registrado, setRegistrado] = useState(false);
  const disponivel = Pronuncia.disponivel();
  function registrar(n: Nivel, nota: number, r?: Resultado) {
    if (registrado) return;
    setRegistrado(true);
    aoRegistrar(n, nota, r);
  }
  return (
    <div className="card blocos">
      <div className="between">
        <span className="eyebrow blocos">{b.aulaTitulo || "Bloco"}</span>
        <span className={"pill" + (estado === "novo" ? " novo" : estado === "revisar" ? " mid" : "")}>{estado === "novo" ? "nova" : estado === "revisar" ? "revisão" : estado}</span>
      </div>
      <p style={{ fontSize: "1.15rem" }}>{b.pt}</p>
      {b.dica ? <p className="small muted">{b.dica}</p> : null}
      {resultado ? <ResultadoFrase r={resultado} /> : (
        <div className={"frase-en" + (revelado ? "" : " oculta")} title={revelado ? undefined : "Toque para ver"} onClick={() => setRevelado(true)}>{b.en}</div>
      )}
      <div className="row">
        <button className="btn" type="button" onClick={() => { setRevelado(true); falar(b.en); }}>▶ Ouvir</button>
        <button className="btn" type="button" onClick={() => { setRevelado(true); falar(b.en, 0.6); }}>▶ Devagar</button>
        {!disponivel ? <button className="btn" type="button" onClick={() => setRevelado(true)}>Mostrar</button> : null}
      </div>
      <p className="small muted">{disponivel ? "Tente falar antes de ouvir. Lembrar sozinho fixa mais." : "Fale em voz alta, depois toque em Mostrar e diga como foi."}</p>
      <Avaliador frase={b.en} cls="blocos" rotulo="Falar em inglês" rotuloDepois="Falar de novo" aoResultado={(r) => { setRevelado(true); setResultado(r); registrar(r.nivel, r.nota, r); }} />
      {!disponivel && revelado && !registrado ? (
        <div className="row">
          <button className="btn" type="button" onClick={() => registrar("bad", 30)}>Errei</button>
          <button className="btn" type="button" onClick={() => registrar("mid", 70)}>Quase</button>
          <button className="btn" type="button" onClick={() => registrar("ok", 100)}>Acertei</button>
        </div>
      ) : null}
      {resultado ? <Veredito r={resultado} /> : null}
      {registrado ? <div className="row"><button className="btn cheio blocos" type="button" onClick={aoProxima}>Próxima →</button></div> : null}
    </div>
  );
}
