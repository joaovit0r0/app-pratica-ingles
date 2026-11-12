import { useStore } from "./lib/store";
import { supabaseConfigurado } from "./lib/supabase";
import { nivelDe } from "./lib/progresso";
import { useRota } from "./lib/rota";
import { Avatar, Icone } from "./componentes/ui";
import { Entrar } from "./telas/Entrar";
import { Perfis } from "./telas/Perfis";
import { Hoje } from "./telas/Hoje";
import { Conversar } from "./telas/Conversar";
import { Praticar } from "./telas/Praticar";
import { Progresso } from "./telas/Progresso";
import { Aulas } from "./telas/Aulas";
import { Ajustes } from "./telas/Ajustes";

const ABAS = [
  { id: "hoje", nome: "Hoje" }, { id: "conversar", nome: "Conversar" }, { id: "praticar", nome: "Praticar" },
  { id: "progresso", nome: "Progresso" }, { id: "aulas", nome: "Aulas" }
];

export function App() {
  const { sessao, carregando, erro, perfil, toasts, sincronizando } = useStore();
  const rota = useRota();
  const [tela, ...args] = rota;

  let conteudo;
  if (!supabaseConfigurado) conteudo = <div className="aviso">Falta configurar o Supabase: crie o arquivo <code>.env.local</code> com <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> (veja o README).</div>;
  else if (!sessao) conteudo = carregando ? <div className="centro muted">Carregando…</div> : <Entrar />;
  else if (carregando && !perfil) conteudo = <div className="centro muted">Carregando…</div>;
  else if (erro) conteudo = <div className="aviso">Não consegui carregar os dados: {erro}</div>;
  else if (!perfil) conteudo = <Perfis />;
  else if (tela === "conversar") conteudo = <Conversar args={args} />;
  else if (tela === "praticar") conteudo = <Praticar args={args} />;
  else if (tela === "progresso") conteudo = <Progresso />;
  else if (tela === "aulas") conteudo = <Aulas args={args} />;
  else if (tela === "ajustes") conteudo = <Ajustes />;
  else conteudo = <Hoje />;

  const abaAtual = ABAS.some((a) => a.id === tela) ? tela : tela === "ajustes" ? null : "hoje";
  const n = perfil ? nivelDe(perfil.progresso.xp) : null;

  return (
    <>
      <div className="wrap">
        <header className="topo">
          <div className="marca"><div className="logo" aria-hidden="true">T</div><h1>Treino de Fala</h1></div>
          {perfil && n ? (
            <a className="perfil-chip" href="#ajustes" aria-label="Perfil e ajustes" style={{ textDecoration: "none" }}>
              <Avatar nome={perfil.nome} cor={perfil.cor} />
              <span className="small num">Nv {n.nivel} · {perfil.progresso.xp} XP</span>
              {sincronizando ? <span className="sync" title="Salvando">•</span> : null}
            </a>
          ) : null}
        </header>
        <main className="stack-lg">{conteudo}</main>
      </div>
      {perfil ? (
        <nav className="abas" aria-label="Seções">
          <div className="abas-in">
            {ABAS.map((a) => (
              <a key={a.id} className="aba" href={"#" + a.id} aria-current={abaAtual === a.id ? "page" : undefined} style={{ textDecoration: "none" }}>
                <Icone nome={a.id} />{a.nome}
              </a>
            ))}
          </div>
        </nav>
      ) : null}
      <div className="toasts">
        {toasts.slice(-3).map((t) => <div key={t.id} className={"toast" + (t.ouro ? " ouro" : "")} role="status">{t.texto}</div>)}
      </div>
    </>
  );
}
