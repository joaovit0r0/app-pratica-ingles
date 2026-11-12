import { useState } from "react";
import { useStore } from "../lib/store";
import type { Perfil } from "../lib/tipos";
import { Avatar, CORES_PERFIL } from "../componentes/ui";
import { ir } from "../lib/rota";

export function Perfis() {
  const { perfis, escolherPerfil } = useStore();
  return (
    <div className="stack-lg">
      <div className="stack">
        <h2>{perfis.length ? "Quem vai praticar agora?" : "Crie o seu perfil"}</h2>
        <p className="muted">Cada pessoa tem o próprio perfil, com progresso, pontos e revisões separados. Os exercícios são os mesmos para todos.</p>
      </div>
      {perfis.length ? (
        <div className="perfis">
          {perfis.map((pf) => (
            <button key={pf.id} className="perfil" type="button" onClick={() => { escolherPerfil(pf.id); ir("hoje"); }}>
              <Avatar nome={pf.nome} cor={pf.cor} grande /><b>{pf.nome}</b>
            </button>
          ))}
        </div>
      ) : null}
      <FormPerfil />
    </div>
  );
}

export function FormPerfil({ existente }: { existente?: Perfil }) {
  const { perfis, criarPerfil, editarPerfil, avisar } = useStore();
  const [nome, setNome] = useState(existente?.nome || "");
  const [cor, setCor] = useState(existente?.cor || CORES_PERFIL[perfis.length % CORES_PERFIL.length]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    const n = nome.trim();
    if (!n) { setErro("Escreva um nome."); return; }
    setSalvando(true); setErro("");
    try {
      if (existente) { await editarPerfil(existente.id, n, cor); avisar("Perfil atualizado"); }
      else { await criarPerfil(n, cor); ir("hoje"); }
    } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  }
  return (
    <div className="card">
      <h3>{existente ? "Editar perfil" : "Novo perfil"}</h3>
      <label className="campo" htmlFor="nome-perfil">Nome<input type="text" id="nome-perfil" maxLength={24} placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} /></label>
      <div className="campo">Cor
        <div className="cores" role="group" aria-label="Cor do perfil">
          {CORES_PERFIL.map((c) => <button key={c} className="cor" type="button" style={{ background: c }} aria-pressed={c === cor} aria-label="Cor" onClick={() => setCor(c)} />)}
        </div>
      </div>
      {erro ? <p className="small erro">{erro}</p> : null}
      <button className="btn cheio" type="button" disabled={salvando} onClick={salvar}>{existente ? "Salvar" : "Criar perfil e começar"}</button>
    </div>
  );
}
