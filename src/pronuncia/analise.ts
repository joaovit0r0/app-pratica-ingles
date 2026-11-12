// Compara os sons (fonemas) que o modelo ouviu com a pronúncia de referência do dicionário CMU.
// Funciona só com texto de fonemas: nenhum áudio passa por aqui.
import PRONUNCIAS from "./pronuncias.json";
import { deArpa } from "./arpa.js";
import type { Nivel } from "../lib/tipos";

export const SIMBOLOS = ["aɪ", "aʊ", "eɪ", "oʊ", "ɔɪ", "b", "d", "f", "g", "h", "i", "j", "k", "l", "m", "n", "p", "s", "t", "u", "v", "w", "z", "æ", "ð", "ŋ", "ɑ", "ə", "ɛ", "ɝ", "ɪ", "ɹ", "ɾ", "ʃ", "ʊ", "ʤ", "ʧ", "θ"];
const VOGAIS = new Set(["aɪ", "aʊ", "eɪ", "oʊ", "ɔɪ", "i", "u", "æ", "ɑ", "ə", "ɛ", "ɝ", "ɪ", "ʊ"]);

export type Fonema = { esperado: string; ouvido: string | null; atono: boolean; nivel: Nivel };
export type PalavraAvaliada = { texto: string; variantes?: string[] | null; lacuna?: boolean; fonemas: Fonema[]; extras: string[]; nota: number | null; nivel: Nivel | null };
export type Dica = { som: string; texto: string };
export type Resultado = {
  fonte: "local" | "rapido"; nota: number; nivel: Nivel; palavras: PalavraAvaliada[]; dicas: Dica[];
  ouvidoIPA?: string; esperadoIPA?: string; texto?: string; segundos: number; qtdPalavras: number;
};

// ---------- dicionário ----------
const pequeno = PRONUNCIAS as Record<string, string[]>;
let completo: Record<string, string> | null = null;
function normalizarPalavra(w: string) { return w.toLowerCase().replace(/[’‘`]/g, "'").replace(/^[^\p{L}']+|[^\p{L}']+$/gu, ""); }
export async function variantes(palavra: string): Promise<string[] | null> {
  const w = normalizarPalavra(palavra);
  if (!w || /[^a-z']/.test(w)) return null; // nomes com acento, números etc. ficam de fora
  if (pequeno[w]) return pequeno[w];
  if (!completo) {
    try { completo = (await import("cmu-pronouncing-dictionary")).dictionary as Record<string, string>; } catch { completo = {}; }
  }
  const v: string[] = [];
  for (const k of [w, w + "(2)", w + "(3)", w + "(4)"]) if (completo[k]) v.push(deArpa(completo[k]));
  return v.length ? v : null;
}

// ---------- alinhamento ----------
export function tokenizar(texto: string): string[] {
  const out: string[] = [];
  const s = String(texto || "").replace(/[|\s]+/g, "");
  let i = 0;
  while (i < s.length) {
    const dois = s.slice(i, i + 2);
    if (SIMBOLOS.includes(dois)) { out.push(dois); i += 2; }
    else if (SIMBOLOS.includes(s[i])) { out.push(s[i]); i += 1; }
    else i += 1;
  }
  return out;
}
const PARECIDOS = [["ɪ", "i"], ["ʊ", "u"], ["ɾ", "t"], ["ɾ", "d"], ["ɝ", "ɹ"], ["ə", "ɝ"], ["ɑ", "ə"], ["ɛ", "æ"], ["eɪ", "ɛ"], ["oʊ", "ɑ"], ["z", "s"]];
function parecido(a: string, b: string) { return PARECIDOS.some((p) => (p[0] === a && p[1] === b) || (p[1] === a && p[0] === b)); }

type Ref = { f: string; atono: boolean; palavra: number };
function custo(e: Ref, o: string): number {
  if (e.f === o) return 0;
  if (e.atono && VOGAIS.has(o) && (e.f === "ə" || e.f === "ɪ" || o === "ə" || o === "ɪ")) return 0.2; // vogal átona reduzida é normal
  if (parecido(e.f, o)) return 0.45;
  if (VOGAIS.has(e.f) && VOGAIS.has(o)) return 0.8;
  return 1;
}
const apagar = (e: Ref) => (e.atono ? 0.6 : 1);
const INSERIR = 0.7;

function alinhar(ref: Ref[], ouv: string[]) {
  const n = ref.length, m = ouv.length;
  const D = Array.from({ length: n + 1 }, () => new Float32Array(m + 1));
  for (let i = 1; i <= n; i++) D[i][0] = D[i - 1][0] + apagar(ref[i - 1]);
  for (let j = 1; j <= m; j++) D[0][j] = j * INSERIR;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    D[i][j] = Math.min(D[i - 1][j - 1] + custo(ref[i - 1], ouv[j - 1]), D[i - 1][j] + apagar(ref[i - 1]), D[i][j - 1] + INSERIR);
  }
  const pares: { ref: number | null; ouv: number | null }[] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && Math.abs(D[i][j] - (D[i - 1][j - 1] + custo(ref[i - 1], ouv[j - 1]))) < 1e-4) { pares.unshift({ ref: i - 1, ouv: j - 1 }); i--; j--; }
    else if (i > 0 && Math.abs(D[i][j] - (D[i - 1][j] + apagar(ref[i - 1]))) < 1e-4) { pares.unshift({ ref: i - 1, ouv: null }); i--; }
    else { pares.unshift({ ref: null, ouv: j - 1 }); j--; }
  }
  return { custo: D[n][m], pares };
}
function montarRef(palavras: PalavraAvaliada[], escolha: number[]): Ref[] {
  const ref: Ref[] = [];
  palavras.forEach((p, k) => {
    if (!p.variantes) return;
    for (const x of p.variantes[escolha[k]].split(" ")) ref.push({ f: x.replace("~", ""), atono: x.includes("~"), palavra: k });
  });
  return ref;
}

export async function analisar(frase: string, ipaOuvido: string): Promise<Omit<Resultado, "segundos" | "qtdPalavras">> {
  const pedacos = frase.split(/\s+/).filter(Boolean);
  const palavras: PalavraAvaliada[] = await Promise.all(pedacos.map(async (p) => {
    const lacuna = /_{2,}/.test(p);
    return { texto: p, variantes: lacuna ? null : await variantes(p), lacuna, fonemas: [], extras: [], nota: null, nivel: null };
  }));
  const ouv = tokenizar(ipaOuvido);
  const escolha = palavras.map(() => 0);
  // escolhe a melhor variante de cada palavra (ex.: "to" como /tu/ ou /tə/)
  for (let k = 0; k < palavras.length; k++) {
    const vs = palavras[k].variantes;
    if (!vs || vs.length < 2) continue;
    let melhor = escolha[k], melhorCusto = Infinity;
    for (let v = 0; v < vs.length; v++) {
      escolha[k] = v;
      const c = alinhar(montarRef(palavras, escolha), ouv).custo;
      if (c < melhorCusto - 1e-6) { melhorCusto = c; melhor = v; }
    }
    escolha[k] = melhor;
  }
  const ref = montarRef(palavras, escolha);
  const al = alinhar(ref, ouv);
  const ultimoDaPalavra: Record<number, number> = {};
  ref.forEach((e, idx) => { ultimoDaPalavra[e.palavra] = idx; });
  let ultimaPalavra = 0, ultimoRef = -1;
  for (const par of al.pares) {
    if (par.ref == null) {
      // sons depois de uma palavra completa, quando a próxima é uma lacuna (___), pertencem à lacuna
      const proxima = palavras[ultimaPalavra + 1];
      if (ultimoRef === ultimoDaPalavra[ultimaPalavra] && proxima && proxima.lacuna) continue;
      if (palavras[ultimaPalavra]) palavras[ultimaPalavra].extras.push(ouv[par.ouv!]);
      continue;
    }
    const e = ref[par.ref];
    ultimaPalavra = e.palavra; ultimoRef = par.ref;
    const o = par.ouv != null ? ouv[par.ouv] : null;
    const c = o == null ? apagar(e) : custo(e, o);
    palavras[e.palavra].fonemas.push({ esperado: e.f, ouvido: o, atono: e.atono, nivel: c <= 0.2 ? "ok" : c < 0.6 ? "mid" : "bad" });
  }
  let somaP = 0, somaN = 0;
  for (const p of palavras) {
    if (!p.variantes) continue;
    const pts = p.fonemas.reduce((s, f) => s + (f.nivel === "ok" ? 1 : f.nivel === "mid" ? 0.6 : 0), 0);
    const den = p.fonemas.length + Math.min(2, p.extras.length) * 0.5;
    p.nota = den ? Math.round((100 * pts) / den) : 0;
    p.nivel = p.nota >= 85 ? "ok" : p.nota >= 60 ? "mid" : "bad";
    somaP += pts; somaN += den;
  }
  const nota = somaN ? Math.round((100 * somaP) / somaN) : 0;
  return {
    fonte: "local", nota, nivel: nota >= 85 ? "ok" : nota >= 65 ? "mid" : "bad",
    palavras, ouvidoIPA: ouv.join(" "), esperadoIPA: ref.map((e) => e.f).join(" "), dicas: dicas(palavras)
  };
}

// ---------- dicas para quem fala português ----------
const DICA_SOM: Record<string, string> = {
  "θ": "Som de \"th\" em think: ponta da língua entre os dentes, soprando. Não troque por t, f ou s.",
  "ð": "Som de \"th\" em the: língua entre os dentes, com a voz vibrando. Não troque por d.",
  "h": "O h inicial é um sopro, parecido com o r de \"rato\". Não deixe mudo.",
  "ɹ": "O r americano: dobre a ponta da língua para trás, sem encostar no céu da boca.",
  "æ": "Abra bem a boca, num som entre é e a, como em \"cat\".",
  "ɪ": "Um i curto e relaxado, quase ê, como em \"sit\". Não estique.",
  "i": "Um i longo e sorrindo, como em \"eat\".",
  "ʊ": "Um u curto e relaxado, como em \"good\".",
  "u": "Um u longo, com os lábios arredondados, como em \"food\".",
  "ŋ": "No final \"ng\", o som fica no fundo da boca. Não pronuncie o g no final.",
  "l": "No l do fim da palavra, a língua encosta no céu da boca. Ele não vira u.",
  "m": "Feche os lábios no m do final da palavra.",
  "n": "Termine o n com a língua encostada atrás dos dentes.",
  "t": "Pronuncie o t limpo. Antes de i ele não vira \"tchi\".",
  "d": "Pronuncie o d limpo. Antes de i ele não vira \"dji\".",
  "z": "O z é um s com a voz vibrando, como em \"is\" e \"does\".",
  "ɝ": "O \"er\" americano, como em \"work\": um r longo com a língua dobrada para trás.",
  "v": "Morda levemente o lábio de baixo e vibre, como em \"very\".",
  "w": "Comece com os lábios arredondados, como um u rápido."
};
function dicas(palavras: PalavraAvaliada[]): Dica[] {
  const contagem: Record<string, number> = {};
  let epentese = 0, finalCortado = 0;
  for (const p of palavras) {
    if (!p.variantes) continue;
    for (const f of p.fonemas) if (f.nivel === "bad" && !f.atono) contagem[f.esperado] = (contagem[f.esperado] || 0) + 1;
    if (p.extras.some((x) => x === "i" || x === "ɪ" || x === "ə")) epentese++;
    const ult = p.fonemas[p.fonemas.length - 1];
    if (ult && !VOGAIS.has(ult.esperado) && ult.ouvido == null) finalCortado++;
  }
  const out: Dica[] = [];
  for (const f of Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a])) if (DICA_SOM[f] && out.length < 2) out.push({ som: f, texto: DICA_SOM[f] });
  if (epentese) out.push({ som: "+i", texto: "Não acrescente um i no fim das palavras: \"club\", não \"clubi\"." });
  if (finalCortado && out.length < 3) out.push({ som: "fim", texto: "Pronuncie o último som das palavras, mesmo quando for uma consoante." });
  return out.slice(0, 3);
}
