// Atividade principal: diário falado e roleplay com a IA. Só o texto vai para a IA; o áudio nunca é gravado.
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import type { Aula, Cena, Correcao } from "../lib/tipos";
import { adicionarBlocoPessoal, completarPasso, ganharXP, registrarFala, todosBlocos } from "../lib/progresso";
import { calar, falar, ouvir, palavras, reconhecimentoDisponivel, type Escuta } from "../lib/voz";
import * as IA from "../lib/ia";
import { hoje } from "../lib/datas";
import { BotaoUmaVez, CartaoConversa, Metrica, Voltar } from "../componentes/ui";
import { ir } from "../lib/rota";

function acharCena(aulas: Aula[], id: string): Cena | null {
  for (const a of aulas) for (const c of a.cenas || []) if (c.id === id) return c;
  return null;
}

export function Conversar({ args }: { args: string[] }) {
  const { aulas, perfil } = useStore();
  if (args[0] === "diario") return <Sessao key="diario" cena={null} />;
  if (args[0] === "cena") {
    const cena = acharCena(aulas, args[1]);
    if (cena) return <Sessao key={cena.id} cena={cena} />;
  }
  const p = perfil!.progresso;
  return (
    <div className="stack-lg">
      <div className="stack">
        <div className="eyebrow conversa">Atividade principal</div>
        <h2>Conversar</h2>
        <p className="muted">Fale em voz alta, sem medo de errar. A IA responde em inglês simples, corrige só o que importa e no fim mostra o que melhorar.</p>
      </div>
      <div className="card conversa">
        <h3>Diário falado</h3>
        <p className="muted">A IA pergunta sobre o seu dia, como um amigo. Bom para fazer todo dia, em 5 minutos.</p>
        <a className="btn cheio grande" href="#conversar/diario">Começar o diário</a>
      </div>
      <div className="stack">
        <h3>Situações para praticar (roleplay)</h3>
        <div className="lista">
          {aulas.flatMap((a) => (a.cenas || []).map((c) => {
            const vezes = p.conversas.filter((x) => x.cena === c.id).length;
            return (
              <a key={c.id} className="item item-btn" href={"#conversar/cena/" + c.id} style={{ textDecoration: "none" }}>
                <div className="between"><b>{c.titulo}</b><span className={"pill" + (vezes ? " ok" : " novo")}>{vezes ? vezes + "x feita" : "nova"}</span></div>
                <span className="small muted">{c.objetivo}</span>
                <span className="small muted">Aula: {a.titulo}</span>
              </a>
            );
          }))}
        </div>
      </div>
      {p.conversas.length ? (
        <div className="stack"><h3>Últimas conversas</h3><div className="lista">{p.conversas.slice(-5).reverse().map((c, i) => <CartaoConversa key={i} c={c} />)}</div></div>
      ) : null}
    </div>
  );
}

const SAUDACAO = "Hi! Let's talk about your day. How are you today?";

function Sessao({ cena }: { cena: Cena | null }) {
  const { aulas, perfil, atualizar } = useStore();
  const blocos = useMemo(() => todosBlocos(aulas).concat(perfil!.progresso.blocosPessoais), [aulas, perfil]);
  const titulo = cena ? cena.titulo : "Diário falado";
  const [msgs, setMsgs] = useState<IA.Mensagem[]>([]);
  const hist = useRef<IA.Mensagem[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [parcial, setParcial] = useState("");
  const [erro, setErro] = useState("");
  const [semIA, setSemIA] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [lerVoz, setLerVoz] = useState(true);
  const [digitado, setDigitado] = useState("");
  const [ajuda, setAjuda] = useState(false);
  const [fim, setFim] = useState<{ turnos: number; palavras: number } | null>(null);
  const escuta = useRef<Escuta | null>(null);
  const lerVozRef = useRef(true);
  const semIARef = useRef(false);
  const encerrada = useRef(false);
  const cont = useRef({ turnos: 0, palavras: 0, correcoes: [] as Correcao[] });
  const perguntas = useMemo(() => aulas.flatMap((a) => a.diario || []).sort(() => Math.random() - 0.5), [aulas]);
  const idxPergunta = useRef(0);
  const fimRef = useRef<HTMLDivElement>(null);

  function adicionar(m: IA.Mensagem) { hist.current = hist.current.concat(m); setMsgs(hist.current); }
  useEffect(() => { fimRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [msgs, parcial]);

  async function vezDaIA() {
    setOcupado(true); setParcial("Pensando…");
    try {
      if (!semIARef.current) {
        const r = await IA.responder(aulas, blocos, cena, hist.current);
        if (encerrada.current) return;
        const corr = r.correction && r.correction.better ? r.correction : null;
        if (corr) cont.current.correcoes.push(corr);
        adicionar({ papel: "ia", texto: r.reply_en, pt: r.reply_pt, correcao: corr });
        if (lerVozRef.current) falar(r.reply_en);
      } else {
        let q: string;
        if (!hist.current.length) q = SAUDACAO;
        else if (idxPergunta.current < perguntas.length && idxPergunta.current < 6) q = perguntas[idxPergunta.current++];
        else q = "Great job today! Tap \"Encerrar\" to finish.";
        adicionar({ papel: "ia", texto: q });
        if (lerVozRef.current) falar(q);
      }
      setErro("");
    } catch (e) {
      if (!encerrada.current) setErro((e as Error).message);
    } finally {
      setOcupado(false); setParcial("");
    }
  }

  useEffect(() => {
    encerrada.current = false;
    vezDaIA();
    return () => { encerrada.current = true; escuta.current?.parar(); calar(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enviar(texto: string, segundos: number) {
    texto = texto.trim();
    if (!texto || ocupado) return;
    const qtd = palavras(texto).length;
    cont.current.turnos += 1; cont.current.palavras += qtd;
    adicionar({ papel: "eu", texto });
    atualizar((p) => { p.totais.turnos += 1; registrarFala(p, segundos || qtd * 0.6, qtd); return ganharXP(p, qtd >= 6 ? 15 : 10); });
    vezDaIA();
  }

  function falarAgora() {
    if (escuta.current) { escuta.current.parar(); return; }
    calar(); setErro(""); setOuvindo(true); setParcial("Pode falar…");
    const e = ouvir({ continuo: true, aoParcial: setParcial });
    escuta.current = e;
    e.promessa.then((r) => enviar(r.texto, r.segundos))
      .catch((er: Error) => setErro(er.message))
      .finally(() => { escuta.current = null; setOuvindo(false); setParcial((t) => (t === "Pensando…" ? t : "")); });
  }

  function encerrar() {
    escuta.current?.parar();
    encerrada.current = true;
    calar();
    const { turnos, palavras: qtd } = cont.current;
    if (!turnos) { ir("conversar"); return; }
    setFim({ turnos, palavras: qtd });
  }

  if (fim) return <Fim cena={cena} titulo={titulo} historico={hist.current} turnos={fim.turnos} qtd={fim.palavras} correcoesTurno={cont.current.correcoes} semIA={semIA} />;

  return (
    <div className="stack-lg">
      <div className="stack">
        <div className="between"><Voltar para="conversar">Voltar</Voltar><button className="btn fantasma" type="button" onClick={encerrar}>Encerrar e ver feedback</button></div>
        <div className="eyebrow conversa">{cena ? "Roleplay" : "Diário falado"}</div>
        <h2>{titulo}</h2>
        {cena ? <p className="muted">Seu objetivo: {cena.objetivo}</p> : null}
        {cena && cena.blocosAlvo.length ? (
          <div className="row">{cena.blocosAlvo.map((id) => blocos.find((b) => b.id === id)).filter(Boolean).map((b) => <span key={b!.id} className="chunk small">{b!.en}</span>)}</div>
        ) : null}
        {semIA ? <div className="aviso info">Modo sem IA: você responde perguntas prontas, sem correções.</div> : null}
      </div>
      <div className="chat" aria-live="polite">
        {msgs.map((m, i) => <Bolha key={i} m={m} />)}
      </div>
      {erro ? (
        <div className="aviso stack" style={{ gap: 8 }}>
          <span>{erro}</span>
          {!semIA && !msgs.length ? <div className="row"><button className="btn" type="button" onClick={() => vezDaIA()}>Tentar de novo</button><button className="btn" type="button" onClick={() => { semIARef.current = true; setSemIA(true); setErro(""); vezDaIA(); }}>Usar perguntas prontas</button></div> : null}
        </div>
      ) : null}
      {ajuda ? <ComoDigo historico={hist.current} fechar={() => setAjuda(false)} /> : null}
      <div className="card conversa" ref={fimRef}>
        <div className="parcial">{parcial}</div>
        <div className="row">
          <button className={"btn cheio grande" + (ouvindo ? " ouvindo" : "")} type="button" disabled={!reconhecimentoDisponivel || (ocupado && !ouvindo)} onClick={falarAgora}>{ouvindo ? "Enviar fala" : "Falar"}</button>
        </div>
        <form className="digitar" onSubmit={(e) => { e.preventDefault(); const t = digitado; setDigitado(""); enviar(t, 0); }}>
          <input type="text" id="digitar-conversa" placeholder={reconhecimentoDisponivel ? "Ou digite em inglês" : "Digite em inglês"} autoComplete="off" value={digitado} onChange={(e) => setDigitado(e.target.value)} />
          <button className="btn" type="submit" disabled={ocupado}>Enviar</button>
        </form>
        <div className="between">
          <label className="small" htmlFor="ler-voz" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" id="ler-voz" checked={lerVoz} onChange={(e) => { setLerVoz(e.target.checked); lerVozRef.current = e.target.checked; if (!e.target.checked) calar(); }} />
            Ler respostas em voz alta
          </label>
          {!semIA ? <button className="btn" type="button" disabled={ocupado} onClick={() => setAjuda(true)}>Como digo…?</button> : null}
        </div>
      </div>
    </div>
  );
}

function CaixaCorrecao({ c }: { c: Correcao }) {
  return (
    <div className="correcao">
      <span className="small">Dica de correção</span>
      <span className="disse">{c.said}</span>
      <span className="melhor">{c.better}</span>
      {c.why_pt ? <span className="small">{c.why_pt}</span> : null}
    </div>
  );
}

function Bolha({ m }: { m: IA.Mensagem }) {
  const [verPt, setVerPt] = useState(false);
  return (
    <>
      {m.correcao ? <CaixaCorrecao c={m.correcao} /> : null}
      <div className={"msg " + m.papel}>
        <div>{m.texto}</div>
        {m.papel === "ia" ? (
          <>
            {verPt && m.pt ? <div className="pt">{m.pt}</div> : null}
            <div className="acoes">
              <button type="button" onClick={() => falar(m.texto)}>▶ Ouvir</button>
              <button type="button" onClick={() => falar(m.texto, 0.65)}>Devagar</button>
              {m.pt ? <button type="button" onClick={() => setVerPt((v) => !v)}>Tradução</button> : null}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

function ComoDigo({ historico, fechar }: { historico: IA.Mensagem[]; fechar: () => void }) {
  const { atualizar } = useStore();
  const [ideia, setIdeia] = useState("");
  const [estado, setEstado] = useState<{ carregando?: boolean; erro?: string; r?: { en: string; dica_pt?: string } }>({});
  async function pedir() {
    const t = ideia.trim();
    if (!t) return;
    setEstado({ carregando: true });
    try { setEstado({ r: await IA.comoDizer(t, historico) }); } catch (e) { setEstado({ erro: (e as Error).message }); }
  }
  return (
    <div className="card">
      <div className="between"><h3>Como digo…?</h3><button className="btn fantasma" type="button" onClick={fechar}>Fechar</button></div>
      <form className="digitar" onSubmit={(e) => { e.preventDefault(); pedir(); }}>
        <input type="text" id="como-digo" autoFocus placeholder="Escreva em português o que quer dizer" value={ideia} onChange={(e) => setIdeia(e.target.value)} />
        <button className="btn cheio" type="submit">Traduzir</button>
      </form>
      <div className="stack">
        {estado.carregando ? <p className="muted">Procurando um jeito simples…</p> : null}
        {estado.erro ? <p className="muted">{estado.erro}</p> : null}
        {estado.r ? (
          <>
            <div className="frase-en" style={{ fontSize: "1.25rem" }}>{estado.r.en}</div>
            {estado.r.dica_pt ? <p className="small muted">{estado.r.dica_pt}</p> : null}
            <div className="row">
              <button className="btn" type="button" onClick={() => falar(estado.r!.en, 0.8)}>▶ Ouvir</button>
              <BotaoUmaVez key={estado.r.en} rotulo="Salvar nos meus blocos" feito="Salvo nos blocos" acao={() => { const en = estado.r!.en; atualizar((p) => { adicionarBlocoPessoal(p, en, ideia.trim(), "conversa"); }); }} />
            </div>
            <p className="small muted">Agora fale a frase com as suas palavras usando o botão Falar.</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Fim({ cena, titulo, historico, turnos, qtd, correcoesTurno, semIA }: { cena: Cena | null; titulo: string; historico: IA.Mensagem[]; turnos: number; qtd: number; correcoesTurno: Correcao[]; semIA: boolean }) {
  const { aulas, atualizar } = useStore();
  const [fb, setFb] = useState<IA.Feedback | null>(null);
  const [erro, setErro] = useState("");
  const feito = useRef(false);
  useEffect(() => {
    if (feito.current) return;
    feito.current = true;
    const id = "c" + Date.now().toString(36);
    // registra a conversa já, para não perder nada se a pessoa sair antes do feedback
    atualizar((p) => {
      p.conversas = p.conversas.concat({ id, data: hoje(), modo: cena ? "cena" : "diario", cena: cena ? cena.id : null, titulo, turnos, palavras: qtd, correcoes: correcoesTurno.slice(0, 5), fluencia: null }).slice(-40);
      if (turnos < 3) return [];
      if (!cena) p.totais.diarios += 1;
      return completarPasso(p, "conversa").concat(ganharXP(p, 40));
    });
    if (semIA) return;
    IA.feedback(aulas, cena, historico).then((r) => {
      setFb(r);
      const vistas = new Set<string>();
      const correcoes = (r.correcoes || []).concat(correcoesTurno).filter((k) => {
        const c = String(k.better || "").toLowerCase().replace(/[^a-z ]/g, "").trim();
        if (!c || vistas.has(c)) return false;
        vistas.add(c); return true;
      }).slice(0, 5);
      atualizar((p) => {
        const c = p.conversas.find((x) => x.id === id);
        if (c) { c.correcoes = correcoes; c.fluencia = r.fluencia || null; }
      });
    }).catch((e: Error) => setErro(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function salvar(en: string, pt: string, origem: string) { atualizar((p) => { adicionarBlocoPessoal(p, en, pt, origem); }); }

  return (
    <div className="stack-lg">
      <div className="eyebrow conversa">Fim da conversa</div>
      <h2>Muito bem!</h2>
      <div className="metricas"><Metrica valor={turnos} rotulo="falas suas" /><Metrica valor={qtd} rotulo="palavras ditas" /></div>
      <div className="card conversa">
        {semIA ? <p className="muted">Sem a IA não há correções nem frases novas desta vez.</p>
          : erro ? <p className="muted">Não consegui gerar o feedback agora: {erro}</p>
          : !fb ? <p className="muted">Preparando o seu feedback…</p>
          : (
            <>
              <p>{fb.resumo_pt || ""}</p>
              {(fb.pontos_fortes || []).length ? <div className="stack" style={{ gap: 4 }}><b>O que foi bem</b>{fb.pontos_fortes!.map((x, i) => <div className="small" key={i}>• {x}</div>)}</div> : null}
              {(fb.correcoes || []).length ? (
                <div className="stack" style={{ gap: 8 }}><b>Para melhorar</b>
                  {fb.correcoes!.map((k, i) => (
                    <div className="correcao" key={i}>
                      <span className="disse">{k.said}</span><span className="melhor">{k.better}</span><span className="small">{k.why_pt || ""}</span>
                      <div className="row"><BotaoUmaVez rotulo="Treinar esta frase" feito="Salvo" acao={() => salvar(k.better, k.why_pt || "", "correção")} /></div>
                    </div>
                  ))}
                </div>
              ) : null}
              {(fb.novos_blocos || []).length ? (
                <div className="stack" style={{ gap: 8 }}><b>Blocos prontos para a próxima vez</b>
                  {fb.novos_blocos!.map((b, i) => (
                    <div className="between item" key={i}>
                      <div><span className="chunk">{b.en}</span><div className="small muted">{b.pt}</div></div>
                      <BotaoUmaVez rotulo="Salvar" feito="Salvo" acao={() => salvar(b.en, b.pt, "conversa")} />
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
      </div>
      <a className="btn cheio" href="#hoje">Voltar para Hoje</a>
    </div>
  );
}
