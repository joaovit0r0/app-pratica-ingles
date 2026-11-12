import { useStore } from "../lib/store";
import { contarDominados, filaDoDia } from "../lib/progresso";
import { Blocos } from "./Blocos";
import { ListaShadowing, Shadowing } from "./Shadowing";
import { Recontar } from "./Recontar";

export function Praticar({ args }: { args: string[] }) {
  const { perfil, aulas } = useStore();
  if (args[0] === "blocos") return <Blocos />;
  if (args[0] === "shadowing") return args[1] ? <Shadowing key={args[1]} id={args[1]} /> : <ListaShadowing />;
  if (args[0] === "recontar") return <Recontar />;
  const p = perfil!.progresso;
  const fila = filaDoDia(p, aulas, 5);
  const cartoes = [
    { cls: "blocos", titulo: "Blocos prontos", desc: "Frases inteiras para usar na conversa. Você vê em português, fala em inglês e o app avalia. As revisões seguem a repetição espaçada: o que você erra volta logo, o que acerta demora mais para voltar.", info: fila.length + " para hoje · " + contarDominados(p) + " dominados", rota: "praticar/blocos" },
    { cls: "shadowing", titulo: "Shadowing", desc: "Ouça um diálogo curto e repita logo em seguida, imitando o ritmo. Melhora a pronúncia e a velocidade.", info: Object.keys(p.shadowing).length + " diálogos feitos", rota: "praticar/shadowing" },
    { cls: "recontar", titulo: "Recontar 3 vezes", desc: "Conte a mesma história 3 vezes, com menos tempo a cada rodada. Treina a fala sem travar.", info: p.recontar.length + " sessões", rota: "praticar/recontar" }
  ];
  return (
    <div className="stack-lg">
      <div className="stack"><h2>Praticar</h2><p className="muted">Exercícios curtos que preparam você para conversar. Cada cor é um tipo de treino.</p></div>
      {cartoes.map((c) => (
        <div className={"card " + c.cls} key={c.cls}>
          <div className="between"><span className={"eyebrow " + c.cls}>{c.titulo}</span><span className="small muted">{c.info}</span></div>
          <p>{c.desc}</p>
          <a className={"btn cheio " + c.cls} href={"#" + c.rota}>Começar</a>
        </div>
      ))}
    </div>
  );
}
