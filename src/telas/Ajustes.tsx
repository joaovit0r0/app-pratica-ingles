import { useRef, useState } from "react";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { lerConfig, salvarConfig } from "../lib/config";
import { importarCopiaAntiga } from "../lib/progresso";
import { dataBR, hoje } from "../lib/datas";
import * as Pronuncia from "../pronuncia";
import * as IA from "../lib/ia";
import { Avatar, BotaoConfirmar } from "../componentes/ui";
import { FormPerfil } from "./Perfis";
import { ir } from "../lib/rota";

export function Ajustes() {
  const { perfil, perfis, escolherPerfil, excluirPerfil, criarPerfil, atualizar, avisar, sessao } = useStore();
  const pf = perfil!;
  const [cfg, setCfg] = useState(lerConfig);
  const [stModelo, setStModelo] = useState(Pronuncia.modeloPronto() ? "Modelo carregado e pronto." : Pronuncia.modeloJaBaixado() ? "Modelo já baixado neste aparelho. Ele carrega em alguns segundos quando você pratica." : "Modelo ainda não baixado neste aparelho.");
  const [baixando, setBaixando] = useState(false);
  const [stIA, setStIA] = useState("");
  const [stCopia, setStCopia] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);

  function mudar(parcial: Partial<ReturnType<typeof lerConfig>>) { setCfg(salvarConfig(parcial)); }

  async function testarIA() {
    setStIA("Testando…");
    try {
      const r = await IA.comoDizer("bom dia", []);
      setStIA("Funcionando. Exemplo: \"" + r.en + "\"");
    } catch (e) { setStIA((e as Error).message); }
  }
  function baixarModelo() {
    setBaixando(true);
    Pronuncia.carregarModelo((e) => setStModelo(e.fase === "baixando" ? "Baixando: " + e.pct + "% de " + e.mb + " MB" : "Preparando…"))
      .then(() => setStModelo("Modelo carregado e pronto."))
      .catch((e: Error) => { setStModelo("Não consegui baixar o modelo: " + e.message); setBaixando(false); });
  }
  function baixarCopia() {
    const dados = { app: "treino-de-fala", versao: 2, data: hoje(), perfis: perfis.map((x) => ({ nome: x.nome, cor: x.cor, progresso: x.progresso })) };
    const blob = new Blob([JSON.stringify(dados, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "treino-de-fala-copia-" + hoje() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setStCopia("Cópia baixada.");
  }
  async function importar(f: File) {
    try {
      const dump = JSON.parse(await f.text());
      const lista = dump?.versao === 2 && Array.isArray(dump.perfis) ? dump.perfis : importarCopiaAntiga(dump);
      for (const x of lista) await criarPerfil(String(x.nome).slice(0, 40), x.cor || "#5e2257", x.progresso);
      setStCopia(lista.length + (lista.length === 1 ? " perfil importado." : " perfis importados.") + " Escolha qual usar em \"Trocar de perfil\".");
    } catch (e) { setStCopia("Não consegui importar: " + (e as Error).message); }
  }

  return (
    <div className="stack-lg">
      <h2>Ajustes</h2>
      <div className="card">
        <div className="row"><Avatar nome={pf.nome} cor={pf.cor} grande /><div><b>{pf.nome}</b>{pf.criado_em ? <div className="small muted">Perfil desde {dataBR(pf.criado_em.slice(0, 10))}</div> : null}</div></div>
        <button className="btn cheio" type="button" onClick={() => { escolherPerfil(null); ir("hoje"); }}>Trocar de perfil</button>
      </div>
      <FormPerfil key={pf.id} existente={pf} />

      <div className="card conversa">
        <h3>Conversa com IA</h3>
        <p className="small muted">A IA é o Gemini, do Google, no plano gratuito. A chave fica guardada no servidor (Supabase) e vale para os dois perfis, em qualquer aparelho. Só o texto da conversa vai para o Google, nunca o áudio. No plano gratuito o Google pode usar esse texto para melhorar os produtos dele, então não fale dados pessoais sensíveis.</p>
        <div className="row"><button className="btn" type="button" onClick={testarIA}>Testar a IA</button></div>
        {stIA ? <p className="small">{stIA}</p> : null}
      </div>

      <div className="card blocos">
        <h3>Avaliação de pronúncia</h3>
        <label className="campo" htmlFor="modo-pronuncia">Como avaliar
          <select id="modo-pronuncia" value={cfg.pronuncia} onChange={(e) => { mudar({ pronuncia: e.target.value as "local" | "rapido" }); avisar("Modo de pronúncia atualizado"); }}>
            <option value="local">Pelo áudio, com modelo no navegador (recomendado)</option>
            <option value="rapido">Rápida, pelo reconhecimento de texto do Chrome</option>
          </select>
        </label>
        <p className="small muted">Pelo áudio: um modelo roda no seu navegador, ouve os sons que você produziu (sem adivinhar palavras) e compara com a pronúncia do dicionário, som por som. Sua voz não sai do aparelho e não fica salva. Ele não avalia entonação. O download é feito uma vez por aparelho; prefira Wi-Fi e computador.</p>
        <div className="row"><button className="btn" type="button" disabled={baixando} onClick={baixarModelo}>{Pronuncia.modeloJaBaixado() ? "Carregar modelo agora" : "Baixar modelo agora (355 MB)"}</button></div>
        <p className="small">{stModelo}</p>
      </div>

      <div className="card">
        <h3>Voz e meta</h3>
        <label className="campo" htmlFor="velocidade">Velocidade da voz
          <select id="velocidade" value={String(cfg.velocidade)} onChange={(e) => mudar({ velocidade: parseFloat(e.target.value) })}>
            <option value="0.7">Devagar</option><option value="0.9">Normal</option><option value="1">Rápida</option>
          </select>
        </label>
        <label className="campo" htmlFor="sotaque">Sotaque
          <select id="sotaque" value={cfg.sotaque} onChange={(e) => { mudar({ sotaque: e.target.value as "en-US" | "en-GB" }); location.reload(); }}>
            <option value="en-US">Americano</option><option value="en-GB">Britânico</option>
          </select>
        </label>
        <label className="campo" htmlFor="meta">Meta diária deste perfil
          <select id="meta" value={String(pf.progresso.metaDiaria)} onChange={(e) => { const v = parseInt(e.target.value, 10); atualizar((p) => { p.metaDiaria = v; }); avisar("Meta atualizada"); }}>
            <option value="60">Leve: 60 XP (cerca de 10 min)</option><option value="120">Normal: 120 XP (cerca de 20 min)</option><option value="200">Intensa: 200 XP (cerca de 35 min)</option>
          </select>
        </label>
      </div>

      <div className="card">
        <h3>Seus dados</h3>
        <p className="small muted">O progresso de cada perfil fica salvo no banco (Supabase) e aparece em qualquer aparelho em que vocês entrarem. Nenhum áudio é guardado: só textos, notas e contadores.</p>
        <div className="row">
          <button className="btn" type="button" onClick={baixarCopia}>Baixar cópia</button>
          <button className="btn" type="button" onClick={() => arquivo.current?.click()}>Importar cópia (inclusive do site antigo)</button>
        </div>
        <input ref={arquivo} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ""; }} />
        {stCopia ? <p className="small">{stCopia}</p> : null}
        <div className="row"><BotaoConfirmar rotulo="Excluir este perfil" confirmar={"Toque de novo para excluir " + pf.nome} acao={() => { excluirPerfil(pf.id).then(() => ir("hoje")).catch((e: Error) => avisar(e.message)); }} /></div>
      </div>

      <div className="card">
        <h3>Conta</h3>
        <p className="small muted">Conectado como {sessao?.user.email}. Ao sair, este aparelho volta para a tela de entrar.</p>
        <div className="row"><button className="btn" type="button" onClick={() => { escolherPerfil(null); supabase.auth.signOut(); }}>Sair da conta</button></div>
      </div>
    </div>
  );
}
