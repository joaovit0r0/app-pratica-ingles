import { useStore } from "../lib/store";
import { CONQUISTAS, contarDominados, estadoCartao, nivelDe, nomeNivel, sequencia, todosBlocos, type EstadoCartao } from "../lib/progresso";
import { dataBR, hoje, somarDias } from "../lib/datas";
import { CartaoConversa, Metrica } from "../componentes/ui";

const NOMES_DIA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function Progresso() {
  const { perfil, aulas } = useStore();
  const p = perfil!.progresso;
  const n = nivelDe(p.xp);
  const minutos = p.totais.segundosFala < 600 ? (Math.round(p.totais.segundosFala / 6) / 10).toLocaleString("pt-BR") : Math.round(p.totais.segundosFala / 60);
  const dias: string[] = [];
  for (let k = 6; k >= 0; k--) dias.push(somarDias(hoje(), -k));
  const max = Math.max(p.metaDiaria, ...dias.map((d) => p.dias[d]?.xp || 0));
  const cont: Record<EstadoCartao, number> = { novo: 0, aprendendo: 0, revisar: 0, dominado: 0 };
  for (const b of todosBlocos(aulas).concat(p.blocosPessoais)) cont[estadoCartao(p, b.id)]++;
  return (
    <div className="stack-lg">
      <h2>Progresso de {perfil!.nome}</h2>
      <div className="metricas">
        <Metrica valor={n.nivel} rotulo={"nível · " + nomeNivel(n.nivel)} />
        <Metrica valor={p.xp} rotulo="XP no total" />
        <Metrica valor={sequencia(p)} rotulo="dias seguidos" />
        <Metrica valor={minutos} rotulo="minutos falando" />
        <Metrica valor={p.totais.palavras} rotulo="palavras ditas" />
        <Metrica valor={p.conversas.length} rotulo="conversas" />
        <Metrica valor={contarDominados(p)} rotulo="blocos dominados" />
        <Metrica valor={Object.keys(p.shadowing).length} rotulo="diálogos no shadowing" />
      </div>
      <div className="card">
        <div className="between"><h3>XP nos últimos 7 dias</h3><span className="small muted">meta {p.metaDiaria}/dia</span></div>
        <div className="semana">
          {dias.map((d) => {
            const xp = p.dias[d]?.xp || 0;
            return (
              <div key={d} className={"col" + (xp ? "" : " vazio")} title={xp + " XP"}>
                <small className="num">{xp ? xp : ""}</small>
                <i style={{ height: Math.max(3, Math.round((60 * xp) / max)) + "px", ...(xp >= p.metaDiaria ? { background: "var(--ouro)" } : {}) }} />
                <small>{NOMES_DIA[new Date(d + "T12:00:00").getDay()]}</small>
              </div>
            );
          })}
        </div>
        <p className="small muted">Barras douradas: dias em que a meta foi batida.</p>
      </div>
      <div className="card blocos">
        <h3>Seus blocos prontos</h3>
        <div className="row">
          <span className="pill novo">{cont.novo} novos</span><span className="pill mid">{cont.revisar} para revisar</span>
          <span className="pill">{cont.aprendendo} aprendendo</span><span className="pill ok">{cont.dominado} dominados</span>
        </div>
        <p className="small muted">Um bloco fica dominado quando o próximo intervalo de revisão passa de 2 semanas.</p>
      </div>
      {p.recontar.length ? (
        <div className="card recontar">
          <h3>Velocidade no recontar</h3>
          <div className="lista">
            {p.recontar.slice(-5).reverse().map((r, i) => (
              <div key={i} className="between small"><span>{dataBR(r.data)} · {r.tema}</span><span className="num">{r.wpm.join(" → ")} palavras/min</span></div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="stack">
        <h3>Conquistas</h3>
        <div className="conquistas">
          {CONQUISTAS.map((c) => {
            const g = p.conquistas[c.id];
            return <div key={c.id} className={"conquista" + (g ? " ganha" : "")}><div className="selo">{g ? "✓" : "?"}</div><b>{c.titulo}</b><span>{g ? "Ganha em " + dataBR(g) : c.desc}</span></div>;
          })}
        </div>
      </div>
      {p.conversas.length ? <div className="stack"><h3>Correções recentes</h3><div className="lista">{p.conversas.slice(-6).reverse().map((c, i) => <CartaoConversa key={i} c={c} />)}</div></div> : null}
    </div>
  );
}
