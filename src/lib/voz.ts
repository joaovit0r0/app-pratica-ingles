// Ler em voz alta (síntese) e reconhecimento de fala do Chrome (usado na conversa e no recontar).
import { lerConfig } from "./config";

let vozIngles: SpeechSynthesisVoice | null = null;
function escolherVoz() {
  if (!("speechSynthesis" in window)) return;
  const sotaque = lerConfig().sotaque;
  const vozes = speechSynthesis.getVoices();
  vozIngles = vozes.find((v) => v.lang === sotaque && /google|natural|samantha|daniel/i.test(v.name))
    || vozes.find((v) => v.lang === sotaque) || vozes.find((v) => /^en/i.test(v.lang)) || null;
}
if (typeof window !== "undefined" && "speechSynthesis" in window) { escolherVoz(); speechSynthesis.onvoiceschanged = escolherVoz; }

export function falar(texto: string, velocidade?: number): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) { resolve(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto.replace(/_{2,}/g, "something"));
    u.lang = lerConfig().sotaque;
    u.rate = velocidade || lerConfig().velocidade;
    if (vozIngles) u.voice = vozIngles;
    u.onend = () => resolve(); u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}
export function calar() { if ("speechSynthesis" in window) speechSynthesis.cancel(); }

const Reconhecedor: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
export const reconhecimentoDisponivel = !!Reconhecedor;

const ERROS: Record<string, string> = {
  "not-allowed": "O navegador bloqueou o microfone. Libere o microfone para este site.",
  "service-not-allowed": "O navegador bloqueou o reconhecimento de voz. Libere o microfone para este site.",
  "no-speech": "Não ouvi nada. Fale logo depois de tocar no botão, perto do microfone.",
  "audio-capture": "Não encontrei um microfone.",
  "network": "O reconhecimento de voz precisa de internet."
};

// Junta os resultados, corrigindo a repetição que o Chrome do Android às vezes produz.
function juntar(results: any[]): string {
  const partes: string[] = [];
  for (const r of results) {
    const t = String(r[0].transcript).trim();
    if (!t) continue;
    const ult = partes[partes.length - 1];
    if (ult && t.toLowerCase().startsWith(ult.toLowerCase())) partes[partes.length - 1] = t;
    else if (ult && ult.toLowerCase().startsWith(t.toLowerCase())) continue;
    else partes.push(t);
  }
  return partes.join(" ");
}

export type Escuta = { parar: () => void; promessa: Promise<{ texto: string; alternativas: string[]; segundos: number }> };

export function ouvir(opcoes: { continuo?: boolean; aoParcial?: (t: string) => void } = {}): Escuta {
  if (!Reconhecedor) return { parar: () => {}, promessa: Promise.reject(new Error("Este navegador não reconhece voz. Use o Google Chrome.")) };
  let rec: any = null, parado = false, finais = "", alternativas: string[] = [];
  const inicio = Date.now();
  let resolver!: (v: any) => void, rejeitar!: (e: Error) => void;
  const promessa = new Promise<{ texto: string; alternativas: string[]; segundos: number }>((res, rej) => { resolver = res; rejeitar = rej; });
  function terminar() {
    if (!finais) { rejeitar(new Error(ERROS["no-speech"])); return; }
    resolver({ texto: finais, alternativas: alternativas.length ? alternativas : [finais], segundos: (Date.now() - inicio) / 1000 });
  }
  function iniciar() {
    rec = new Reconhecedor();
    rec.lang = lerConfig().sotaque;
    rec.interimResults = true;
    rec.maxAlternatives = opcoes.continuo ? 1 : 5;
    rec.continuous = !!opcoes.continuo;
    const anterior = finais;
    rec.onresult = (ev: any) => {
      const fin: any[] = []; let parcial = "";
      for (let i = 0; i < ev.results.length; i++) { if (ev.results[i].isFinal) fin.push(ev.results[i]); else parcial += ev.results[i][0].transcript; }
      finais = (anterior + " " + juntar(fin)).trim();
      if (!opcoes.continuo && fin.length) { const r = fin[fin.length - 1]; alternativas = []; for (let k = 0; k < r.length; k++) alternativas.push(r[k].transcript); }
      opcoes.aoParcial?.((finais + " " + parcial).trim());
    };
    rec.onerror = (ev: any) => {
      if (ev.error === "no-speech" && opcoes.continuo && !parado) return;
      if (ev.error === "aborted") return;
      parado = true;
      rejeitar(new Error(ERROS[ev.error] || "Não consegui ouvir (" + ev.error + ")."));
    };
    rec.onend = () => { if (!parado && opcoes.continuo) { try { iniciar(); } catch { terminar(); } return; } terminar(); };
    rec.start();
  }
  try { iniciar(); } catch (e) { rejeitar(e as Error); }
  return { parar: () => { parado = true; try { rec?.stop(); } catch { terminar(); } }, promessa };
}

// ---------- comparação por texto (modo rápido) ----------
const NUMEROS: Record<string, string> = { "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten", "11": "eleven", "12": "twelve" };
const CONTRACOES: Record<string, string> = {
  "i'm": "i am", "you're": "you are", "it's": "it is", "we're": "we are", "they're": "they are", "i've": "i have", "i'll": "i will", "i'd": "i would",
  "don't": "do not", "doesn't": "does not", "didn't": "did not", "can't": "cannot", "won't": "will not", "isn't": "is not", "aren't": "are not",
  "what's": "what is", "where's": "where is", "that's": "that is", "there's": "there is", "let's": "let us"
};
export function palavras(texto: string): string[] {
  const limpo = String(texto || "").toLowerCase().replace(/[’‘`]/g, "'").replace(/_{2,}/g, " ").replace(/[^a-z0-9' ]+/g, " ");
  const saida: string[] = [];
  for (let w of limpo.split(/\s+/).filter(Boolean)) {
    w = w.replace(/^'+|'+$/g, ""); if (!w) continue;
    if (NUMEROS[w]) w = NUMEROS[w];
    (CONTRACOES[w] ? CONTRACOES[w].split(" ") : [w]).forEach((x) => saida.push(x));
  }
  return saida;
}
function alinhar(alvo: string[], ouvido: string[]): boolean[] {
  const n = alvo.length, m = ouvido.length;
  const t = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = alvo[i] === ouvido[j] ? 1 + t[i + 1][j + 1] : Math.max(t[i + 1][j], t[i][j + 1]);
  const marca = new Array(n).fill(false); let i = 0, j = 0;
  while (i < n && j < m) { if (alvo[i] === ouvido[j]) { marca[i] = true; i++; j++; } else if (t[i + 1][j] >= t[i][j + 1]) i++; else j++; }
  return marca;
}
export function avaliarTexto(frase: string, alternativas: string[]) {
  const lacuna = /_{2,}/.test(frase);
  const alvo = palavras(frase);
  let melhor: { nota: number; marca: boolean[]; texto: string; nivel: "ok" | "mid" | "bad" } | null = null;
  for (const alt of alternativas) {
    const ouvido = palavras(alt);
    const marca = alinhar(alvo, ouvido);
    const acertos = marca.filter(Boolean).length;
    let extras = Math.max(0, ouvido.length - acertos); if (lacuna) extras = Math.max(0, extras - 3);
    const nota = alvo.length ? Math.max(0, Math.min(100, Math.round((100 * (acertos - 0.5 * extras)) / alvo.length))) : 0;
    if (!melhor || nota > melhor.nota) melhor = { nota, marca, texto: alt, nivel: nota >= 90 ? "ok" : nota >= 60 ? "mid" : "bad" };
  }
  return melhor!;
}
