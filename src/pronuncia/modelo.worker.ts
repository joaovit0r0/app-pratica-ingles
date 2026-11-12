// Roda o modelo de fonemas fora da tela principal, para a página não travar.
// O áudio chega aqui só na memória e é descartado depois da análise.
import { env, pipeline } from "@huggingface/transformers";

const MODELO = "robg/speako-phoneme-recognizer";
env.allowLocalModels = false;

let asr: any = null;
let carregando: Promise<any> | null = null;

function carregar() {
  if (asr) return Promise.resolve(asr);
  if (carregando) return carregando;
  const arquivos: Record<string, { c: number; t: number }> = {};
  carregando = (pipeline as any)("automatic-speech-recognition", MODELO, {
    dtype: "q8",
    device: "wasm",
    progress_callback: (ev: any) => {
      if (ev.status === "progress" && ev.total) {
        arquivos[ev.file] = { c: ev.loaded, t: ev.total };
        let c = 0, t = 0;
        for (const k in arquivos) { c += arquivos[k].c; t += arquivos[k].t; }
        self.postMessage({ tipo: "progresso", pct: Math.round((100 * c) / t), mb: Math.round(t / 1048576) });
      }
    }
  }).then((p: any) => { asr = p; return p; });
  carregando!.catch(() => { carregando = null; });
  return carregando!;
}

self.onmessage = async (ev: MessageEvent) => {
  const { id, tipo, audio } = ev.data || {};
  try {
    if (tipo === "carregar") { await carregar(); self.postMessage({ id, tipo: "pronto" }); return; }
    if (tipo === "ouvir") {
      const p = await carregar();
      const r = await p(audio as Float32Array);
      self.postMessage({ id, tipo: "texto", texto: String(r?.text || "") });
    }
  } catch (e) {
    self.postMessage({ id, tipo: "erro", erro: (e as Error)?.message || String(e) });
  }
};
