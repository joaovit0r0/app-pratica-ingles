// Material das aulas. Fica no banco e vale para os dois perfis.
import { useState } from "react";
import { useStore } from "../lib/store";
import type { Aula } from "../lib/tipos";
import { estadoCartao } from "../lib/progresso";
import * as IA from "../lib/ia";
import { BotaoConfirmar, Voltar } from "../componentes/ui";
import { ir } from "../lib/rota";

export function Aulas({ args }: { args: string[] }) {
  const { perfil, aulas, removerAula, avisar } = useStore();
  const [aberta, setAberta] = useState<string | null>(null);
  if (args[0] === "nova") return <NovaAula />;
  const p = perfil!.progresso;
  const ordenadas = aulas.filter((a) => !a.extra).reverse().concat(aulas.filter((a) => a.extra));
  return (
    <div className="stack-lg">
      <div className="stack"><h2>Aulas</h2><p className="muted">Todo o material vem daqui e vale para os dois perfis. A cada aula nova, os exercícios, diálogos e conversas passam a usar o conteúdo dela.</p></div>
      <a className="btn cheio" href="#aulas/nova">Adicionar aula nova</a>
      {ordenadas.map((a) => (
        <div className="card" key={a.id}>
          <div className="between"><h3>{a.titulo}</h3>{a.extra ? <span className="pill">extra</span> : a.criada ? <span className="pill novo">adicionada aqui</span> : null}</div>
          <p className="muted small">{a.resumo || ""}</p>
          <div className="row small">
            <span className="pill" style={{ color: "var(--blocos)" }}>{(a.blocos || []).length} blocos</span>
            <span className="pill" style={{ color: "var(--shadow)" }}>{(a.dialogos || []).length} diálogos</span>
            <span className="pill" style={{ color: "var(--berinjela)" }}>{(a.cenas || []).length} situações</span>
          </div>
          <div className="row">
            <button className="btn" type="button" onClick={() => setAberta(aberta === a.id ? null : a.id)}>{aberta === a.id ? "Esconder frases" : "Ver frases"}</button>
            {a.criada ? <BotaoConfirmar rotulo="Remover aula" confirmar="Remover de verdade" acao={() => removerAula(a.id).then(() => avisar("Aula removida")).catch((e: Error) => avisar(e.message))} /> : null}
          </div>
          {aberta === a.id ? (
            <div className="lista">
              {(a.blocos || []).map((b) => {
                const e = estadoCartao(p, b.id);
                return (
                  <div key={b.id} className="between item">
                    <div style={{ minWidth: 0 }}><b>{b.en}</b><div className="small muted">{b.pt}</div></div>
                    <span className={"pill" + (e === "dominado" ? " ok" : e === "revisar" ? " mid" : e === "novo" ? " novo" : "")}>{e}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ))}
      {p.blocosPessoais.length ? (
        <div className="card"><h3>Minhas frases (das conversas)</h3>
          <div className="lista">{p.blocosPessoais.map((b) => <div className="item" key={b.id}><b>{b.en}</b><span className="small muted">{b.pt}</span></div>)}</div>
        </div>
      ) : null}
    </div>
  );
}

function NovaAula() {
  const { aulas, salvarAula, avisar } = useStore();
  const [material, setMaterial] = useState("");
  const [json, setJson] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [previa, setPrevia] = useState<Aula | null>(null);
  const [salvando, setSalvando] = useState(false);
  const proximaOrdem = Math.max(0, ...aulas.filter((a) => !a.extra).map((a) => a.ordem)) + 1;
  const novoId = () => "a" + Date.now().toString(36);

  async function gerar() {
    if (!material.trim()) return;
    setErro(""); setPrevia(null); setGerando(true);
    try { setPrevia(await IA.gerarAula(material.trim(), novoId(), proximaOrdem, aulas)); }
    catch (e) { setErro((e as Error).message); }
    setGerando(false);
  }
  async function salvar(a: Aula) {
    setSalvando(true);
    try { await salvarAula(a); avisar("Aula adicionada para os dois perfis", true); ir("aulas"); }
    catch (e) { setErro("Não consegui salvar: " + (e as Error).message); }
    setSalvando(false);
  }
  function colar() {
    try {
      const j = JSON.parse(json);
      setPrevia(IA.montarAula(j, typeof j.id === "string" && j.id ? j.id : novoId(), typeof j.ordem === "number" ? j.ordem : proximaOrdem));
      setErro("");
      window.scrollTo(0, 0);
    } catch (e) { setErro("Não consegui ler: " + (e as Error).message); window.scrollTo(0, 0); }
  }

  return (
    <div className="stack-lg">
      <div className="stack">
        <Voltar para="aulas">Aulas</Voltar>
        <h2>Adicionar aula nova</h2>
        <p className="muted">Cole as anotações da aula e a IA monta frases, diálogos e situações no mesmo nível. A aula fica salva no banco e aparece para os dois perfis, em qualquer aparelho.</p>
      </div>
      {erro ? <div className="aviso">{erro}</div> : null}
      {previa ? (
        <div className="card">
          <h3>{previa.titulo}</h3>
          <p className="small muted">{previa.resumo}</p>
          {previa.estruturas ? <p className="small"><b>Estruturas:</b> {previa.estruturas}</p> : null}
          <div className="lista">{previa.blocos.map((b) => <div className="item" key={b.id}><b>{b.en}</b><span className="small muted">{b.pt}</span></div>)}</div>
          <p className="small muted">{previa.dialogos.length} diálogos, {previa.cenas.length} situações de conversa, {previa.diario.length} perguntas para o diário.</p>
          <div className="row">
            <button className="btn cheio" type="button" disabled={salvando} onClick={() => salvar(previa)}>{salvando ? "Salvando…" : "Salvar aula"}</button>
            <button className="btn" type="button" onClick={() => setPrevia(null)}>Descartar</button>
          </div>
        </div>
      ) : null}
      <div className="card">
        <h3>Gerar com a IA</h3>
        <label className="campo" htmlFor="material-aula">Anotações da aula
          <textarea id="material-aula" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Cole aqui as anotações da aula: frases, palavras novas, correções da professora, o tema da conversa…" />
        </label>
        <button className="btn cheio" type="button" disabled={gerando || !material.trim()} onClick={gerar}>{gerando ? "Criando… (uns 20 segundos)" : "Gerar exercícios"}</button>
      </div>
      <details className="card">
        <summary>Colar uma aula pronta (formato do Claude)</summary>
        <p className="small muted">Se o Claude te mandar uma aula em texto começando com {"{"}, cole aqui.</p>
        <textarea id="json-aula" value={json} onChange={(e) => setJson(e.target.value)} placeholder={'{ "titulo": "…", "blocos": [ … ] }'} />
        <button className="btn" type="button" onClick={colar}>Ver prévia</button>
      </details>
    </div>
  );
}
