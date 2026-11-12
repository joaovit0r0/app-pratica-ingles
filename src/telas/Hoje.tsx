import { useStore } from "../lib/store";
import { bonusSequencia, diaLeitura, filaDoDia, nivelDe, nomeNivel, sequencia } from "../lib/progresso";
import { reconhecimentoDisponivel } from "../lib/voz";
import * as Pronuncia from "../pronuncia";
import { Icone } from "../componentes/ui";

export function Hoje() {
  const { perfil, aulas } = useStore();
  const p = perfil!.progresso;
  const d = diaLeitura(p);
  const n = nivelDe(p.xp);
  const seq = sequencia(p);
  const bonus = Math.round(bonusSequencia(p) * 100);
  const fila = filaDoDia(p, aulas, 5);
  const m = d.missao;
  const passos = [
    { cls: "conversa", ic: "conversar", titulo: "Diário falado com a IA", desc: "5 minutos contando sobre o seu dia", feito: m.conversa, rota: "conversar/diario" },
    { cls: "blocos", ic: "blocos", titulo: "Blocos prontos", desc: fila.length ? fila.length + " frases para revisar falando" : "Nada pendente, só frases novas", feito: m.blocos, rota: "praticar/blocos" },
    { cls: "shadowing", ic: "shadowing", titulo: "Shadowing", desc: "Repita um diálogo curto junto com o áudio", feito: m.shadowing, rota: "praticar/shadowing" },
    { cls: "recontar", ic: "recontar", titulo: "Recontar (bônus)", desc: "Conte a mesma história 3 vezes, cada vez mais rápido", feito: m.recontar, rota: "praticar/recontar" }
  ];
  const principais = passos.slice(0, 3).filter((x) => x.feito).length;
  return (
    <>
      {!reconhecimentoDisponivel ? <div className="aviso">Para conversar falando, abra este site no Google Chrome (Android ou computador). Neste navegador você ainda pode ouvir as frases e conversar digitando.</div> : null}
      <div className="card hero">
        <div className="between">
          <div><div className="small muted">Olá, {perfil!.nome}</div><h2>Nível {n.nivel}: {nomeNivel(n.nivel)}</h2></div>
          <div className="small" style={{ display: "grid", justifyItems: "end", textAlign: "right", gap: 0, marginLeft: "auto" }}>
            <b className="num" style={{ fontSize: "1.1rem" }}>{seq} {seq === 1 ? "dia seguido" : "dias seguidos"}</b>
            <span className="muted">{seq ? "bônus de +" + bonus + "% no XP" : "comece hoje"}</span>
          </div>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <div className="between small"><span>Meta de hoje</span><span className="num">{Math.min(d.xp, p.metaDiaria)} / {p.metaDiaria} XP</span></div>
          <div className="barra" role="progressbar" aria-valuemin={0} aria-valuemax={p.metaDiaria} aria-valuenow={d.xp}><span style={{ width: Math.min(100, Math.round((100 * d.xp) / p.metaDiaria)) + "%" }} /></div>
        </div>
        <div className="small muted num">Faltam {n.proximo - n.atual} XP para o nível {n.nivel + 1}</div>
      </div>
      {Pronuncia.modo() === "local" && !Pronuncia.modeloJaBaixado() ? (
        <div className="aviso info">A avaliação de pronúncia usa um modelo de 355 MB que roda no seu navegador. <a href="#ajustes">Baixe uma vez em Ajustes</a>, de preferência no Wi-Fi. Ou ele baixa sozinho no primeiro exercício.</div>
      ) : null}
      <div className="card">
        <div className="between"><h3>Missão do dia</h3><span className={"pill" + (principais === 3 ? " ok" : "")}>{principais} de 3</span></div>
        <div className="missao">
          {passos.map((x) => (
            <a key={x.cls} className={"passo " + x.cls + (x.feito ? " feito" : "")} href={"#" + x.rota} style={{ textDecoration: "none" }}>
              <span className="ic"><Icone nome={x.ic} /></span>
              <span><b>{x.titulo}</b><div className="small muted">{x.desc}</div></span>
              <span className="estado">{x.feito ? "Feito" : "Começar"}</span>
            </a>
          ))}
        </div>
        <p className="small muted">{m.bau ? "Missão completa. Você ganhou o bônus de 50 XP hoje." : "Complete os 3 primeiros passos para ganhar 50 XP de bônus."}</p>
      </div>
    </>
  );
}
