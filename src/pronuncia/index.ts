// Avaliação de pronúncia.
// Modo "local": grava a voz e roda no navegador um modelo que ouve os SONS (fonemas), sem adivinhar palavras,
// e compara com a pronúncia do dicionário CMU. Modo "rapido": usa o reconhecimento de voz do Chrome (texto).
// Nenhum áudio é salvo: a gravação fica na memória só até a avaliação terminar.
import { lerConfig, salvarConfig } from "../lib/config";
import { avaliarTexto, ouvir, palavras as palavrasTexto, reconhecimentoDisponivel } from "../lib/voz";
import { analisar, type PalavraAvaliada, type Resultado } from "./analise";
import { gravar, microfoneDisponivel } from "./gravar";

export type { Resultado, PalavraAvaliada } from "./analise";
export type Estado = { fase: "carregando" | "baixando" | "ouvindo" | "analisando"; pct?: number; mb?: number };

export function modo() { return lerConfig().pronuncia; }
export function disponivel() { return modo() === "local" ? microfoneDisponivel() : reconhecimentoDisponivel; }

// ---------- worker do modelo ----------
let worker: Worker | null = null;
let pronto = false;
let carregando: Promise<void> | null = null;
let seq = 0;
const esperando = new Map<number, { ok: (v: any) => void; falha: (e: Error) => void }>();
const ouvintesProgresso = new Set<(e: Estado) => void>();

function obterWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./modelo.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (ev) => {
    const m = ev.data;
    if (m.tipo === "progresso") { ouvintesProgresso.forEach((f) => f({ fase: "baixando", pct: m.pct, mb: m.mb })); return; }
    const w = esperando.get(m.id);
    if (!w) return;
    esperando.delete(m.id);
    if (m.tipo === "erro") w.falha(new Error(m.erro)); else w.ok(m);
  };
  worker.onerror = (e) => { for (const w of esperando.values()) w.falha(new Error(e.message || "O modelo parou.")); esperando.clear(); worker = null; pronto = false; carregando = null; };
  return worker;
}
function pedir(msg: any, transferir: Transferable[] = []): Promise<any> {
  const id = ++seq;
  return new Promise((ok, falha) => { esperando.set(id, { ok, falha }); obterWorker().postMessage({ ...msg, id }, transferir); });
}

export function carregarModelo(aoProgresso?: (e: Estado) => void): Promise<void> {
  if (aoProgresso) ouvintesProgresso.add(aoProgresso);
  if (pronto) return Promise.resolve();
  if (!carregando) {
    carregando = pedir({ tipo: "carregar" }).then(() => { pronto = true; salvarConfig({ modeloBaixado: true }); });
    carregando.catch(() => { carregando = null; });
  }
  return carregando.finally(() => { if (aoProgresso) ouvintesProgresso.delete(aoProgresso); });
}
export function modeloPronto() { return pronto; }
export function modeloJaBaixado() { return lerConfig().modeloBaixado; }

// ---------- tentativa completa ----------
export type Tentativa = { parar: () => void; cancelar: () => void; promessa: Promise<Resultado> };

export function tentar(frase: string, opcoes: { aoEstado?: (e: Estado) => void; aoVolume?: (v: number) => void } = {}): Tentativa {
  if (modo() !== "local") return tentarRapido(frase);
  let g: ReturnType<typeof gravar> | null = null;
  let cancelado = false;
  const promessa = (async () => {
    if (!pronto) {
      opcoes.aoEstado?.({ fase: "carregando" });
      await carregarModelo(opcoes.aoEstado);
    }
    if (cancelado) throw new Error("Cancelado.");
    opcoes.aoEstado?.({ fase: "ouvindo" });
    g = gravar({ aoVolume: opcoes.aoVolume });
    const r = await g.promessa;
    opcoes.aoEstado?.({ fase: "analisando" });
    const { texto } = await pedir({ tipo: "ouvir", audio: r.audio }, [r.audio.buffer]);
    const res = await analisar(frase, texto);
    return { ...res, segundos: r.segundos, qtdPalavras: frase.split(/\s+/).filter(Boolean).length };
  })();
  return { parar: () => g?.parar(), cancelar: () => { cancelado = true; g?.cancelar(); }, promessa };
}

function tentarRapido(frase: string): Tentativa {
  const e = ouvir({ continuo: false });
  const promessa = e.promessa.then((r) => {
    const av = avaliarTexto(frase, r.alternativas);
    const lista: PalavraAvaliada[] = [];
    let k = 0;
    for (const p of frase.split(/\s+/).filter(Boolean)) {
      const qtd = palavrasTexto(p).length;
      let ok = true; for (let q = 0; q < qtd; q++) if (!av.marca[k + q]) ok = false;
      k += qtd;
      const neutra = /_{2,}/.test(p) || !qtd;
      lista.push({ texto: p, nota: neutra ? null : ok ? 100 : 0, nivel: neutra ? null : ok ? "ok" : "bad", fonemas: [], extras: [] });
    }
    return { fonte: "rapido" as const, nota: av.nota, nivel: av.nivel, palavras: lista, texto: av.texto, dicas: [], segundos: r.segundos, qtdPalavras: palavrasTexto(r.texto).length };
  });
  return { parar: e.parar, cancelar: e.parar, promessa };
}
