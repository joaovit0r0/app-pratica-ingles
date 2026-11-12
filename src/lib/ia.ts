// Conversa com a IA (Gemini) pela Edge Function "ia" do Supabase.
// A chave do Gemini fica no servidor. Só texto é enviado, nunca áudio.
import { supabase } from "./supabase";
import type { Aula, Bloco, Cena, Correcao } from "./tipos";
import { hoje } from "./datas";

export type Mensagem = { papel: "eu" | "ia"; texto: string; pt?: string; correcao?: Correcao | null };

async function gerar(sistema: string, mensagens: { papel: "eu" | "ia"; texto: string }[], opcoes: { temperatura?: number; max?: number } = {}): Promise<any> {
  const { data, error } = await supabase.functions.invoke("ia", {
    body: { sistema, mensagens: mensagens.map((m) => ({ papel: m.papel, texto: m.texto })), temperatura: opcoes.temperatura, max: opcoes.max }
  });
  if (error) {
    let msg = "A IA não respondeu. Confira a internet e tente de novo.";
    const ctx = (error as any).context;
    if (ctx && typeof ctx.json === "function") {
      try { const j = await ctx.json(); if (j?.erro) msg = j.erro; } catch { /* resposta sem JSON */ }
    }
    throw new Error(msg);
  }
  if (data && typeof data === "object" && "erro" in data) throw new Error(String((data as any).erro));
  return data;
}

const REGRAS = [
  "You are a warm, patient English conversation partner for a Brazilian beginner (CEFR A1 to A2) who speaks Portuguese.",
  "The learner speaks through speech recognition, so ignore missing punctuation, capitalization and small transcription glitches.",
  "Rules for every reply:",
  "- Use very simple English: short sentences, common words, mostly present simple. Avoid past and future tenses unless the learner uses them first.",
  "- Build your sentences mainly with the structures the learner already studied in class (listed below), so they can understand and copy you.",
  "- Reply with at most 2 short sentences, then ask exactly 1 simple question to keep the learner talking.",
  "- Naturally reuse the target phrases when they fit.",
  "- If the learner writes in Portuguese or mixes languages, show them how to say it in English in reply_en (\"You can say: ...\") and continue.",
  "- Corrections: only if there is a real mistake that matters (wrong word, wrong tense, missing verb). At most 1 correction per turn. Do not correct style or tiny things. If the message is fine, correction is null.",
  "- Be encouraging, never sarcastic. No emojis.",
  "Always answer with JSON only, in this exact shape:",
  "{\"reply_en\": \"...\", \"reply_pt\": \"tradução natural em português do Brasil\", \"correction\": null or {\"said\": \"what the learner said (short)\", \"better\": \"corrected version\", \"why_pt\": \"explicação curta em português\"}}"
].join("\n");

function estudado(aulas: Aula[]): string {
  const l = aulas.filter((a) => a.estruturas).map((a) => "- " + a.titulo + ": " + a.estruturas);
  return l.length ? "\n\nWhat the learner studied in class so far:\n" + l.join("\n") : "";
}

function sistemaConversa(aulas: Aula[], cena: Cena | null, blocos: Bloco[]): string {
  if (!cena) {
    const recentes = blocos.slice(-20).map((b) => "- " + b.en).join("\n");
    return REGRAS + estudado(aulas) + "\n\nActivity: spoken diary. Talk about the learner's habits and routine: what they eat and drink in the morning, afternoon and at night, where they go, on which days and how often, what they like and prefer. One topic at a time, like a friendly friend. Start with a short greeting and one simple question.\n\nTarget phrases the learner is studying:\n" + recentes;
  }
  const alvo = cena.blocosAlvo.map((id) => blocos.find((b) => b.id === id)).filter(Boolean).map((b) => "- " + b!.en).join("\n");
  return REGRAS + estudado(aulas) + "\n\nActivity: role-play. You are " + cena.papel + ". Stay in character. The learner's goal (in Portuguese): " + cena.objetivo + "\nStart the scene with a short, natural opening line.\n\nTarget phrases for this scene:\n" + alvo;
}

const INICIO = { papel: "eu" as const, texto: "(Start the conversation now.)" };

export async function responder(aulas: Aula[], blocos: Bloco[], cena: Cena | null, historico: Mensagem[]): Promise<{ reply_en: string; reply_pt?: string; correction?: Correcao | null }> {
  const msgs = historico.slice(-40).map((m) => ({ papel: m.papel, texto: m.texto }));
  if (!msgs.length || msgs[0].papel === "ia") msgs.unshift(INICIO);
  const j = await gerar(sistemaConversa(aulas, cena, blocos), msgs);
  if (!j?.reply_en) throw new Error("A IA respondeu num formato inesperado. Tente de novo.");
  return j;
}

export type Feedback = { resumo_pt?: string; pontos_fortes?: string[]; correcoes?: Correcao[]; novos_blocos?: { en: string; pt: string }[]; fluencia?: number };

export async function feedback(aulas: Aula[], cena: Cena | null, historico: Mensagem[]): Promise<Feedback> {
  const transcricao = historico.map((m) => (m.papel === "ia" ? "Partner: " : "Learner: ") + m.texto).join("\n");
  const sistema = [
    "You are an English teacher giving end-of-conversation feedback to a Brazilian beginner (A1 to A2). Write explanations in Brazilian Portuguese, simple and encouraging.",
    "Ignore punctuation and speech recognition glitches. Focus on the 3 most useful improvements for speaking, preferring mistakes in the structures the learner already studied." + estudado(aulas),
    "Answer with JSON only, in this shape:",
    "{\"resumo_pt\": \"2 frases sobre como foi\", \"pontos_fortes\": [\"...\", \"...\"], \"correcoes\": [{\"said\": \"...\", \"better\": \"...\", \"why_pt\": \"...\"}], \"novos_blocos\": [{\"en\": \"useful ready-made phrase for next time\", \"pt\": \"tradução\"}], \"fluencia\": 1-5}",
    "Give at most 3 correcoes and 3 novos_blocos. novos_blocos must be short, reusable chunks (3 to 8 words) the learner needed in this conversation."
  ].join("\n");
  return gerar(sistema, [{ papel: "eu", texto: "Conversation (" + (cena ? "role-play: " + cena.titulo : "spoken diary") + "):\n" + transcricao }], { temperatura: 0.3 });
}

export async function comoDizer(ideiaPt: string, historico: Mensagem[]): Promise<{ en: string; dica_pt?: string }> {
  const contexto = historico.slice(-4).map((m) => (m.papel === "ia" ? "Partner: " : "Learner: ") + m.texto).join("\n");
  const sistema = "You help a Brazilian A1 English learner say something in simple English during a conversation. Answer JSON only: {\"en\": \"simple English sentence\", \"dica_pt\": \"dica curta em português, opcional\"}";
  return gerar(sistema, [{ papel: "eu", texto: "Conversation so far:\n" + contexto + "\n\nWhat I want to say in Portuguese: " + ideiaPt }], { temperatura: 0.3, max: 300 });
}

export async function gerarAula(material: string, id: string, ordem: number, aulas: Aula[]): Promise<Aula> {
  const sistema = [
    "You turn a Brazilian beginner's English class notes into practice material. The learner is A1 to A2. Keep the same level and topics as the notes. You may add a few closely related, very common phrases." + estudado(aulas),
    "Answer with JSON only, in this exact shape (Portuguese fields in Brazilian Portuguese):",
    "{\"titulo\": \"título curto em português\", \"resumo\": \"1 frase em português\",",
    "\"estruturas\": \"the grammar structures and vocabulary of these notes, in English, one line (e.g. 'go to + place; How often do you...?; once/twice a week')\",",
    "\"blocos\": [{\"en\": \"ready-made phrase\", \"pt\": \"tradução\", \"dica\": \"dica curta em português, opcional\"}],",
    "\"dialogos\": [{\"titulo\": \"...\", \"linhas\": [{\"quem\": \"A\" or \"B\", \"en\": \"...\", \"pt\": \"...\"}]}],",
    "\"cenas\": [{\"titulo\": \"título em português\", \"papel\": \"who the AI plays, in English\", \"objetivo\": \"objetivo do aluno em português\", \"blocosAlvo\": [indexes of blocos, starting at 0]}],",
    "\"diario\": [\"simple question in English\"], \"recontar\": [\"tema em português\"]}",
    "Give 8 to 14 blocos, 2 dialogos with 5 to 7 lines each, 2 cenas, 3 diario questions and 1 or 2 recontar topics."
  ].join("\n");
  const j = await gerar(sistema, [{ papel: "eu", texto: "Class notes:\n" + material }], { temperatura: 0.4, max: 4096 });
  return montarAula(j, id, ordem);
}

// Também usado para colar uma aula em JSON.
export function montarAula(j: any, id: string, ordem: number): Aula {
  if (!j || typeof j !== "object") throw new Error("Conteúdo inválido.");
  const blocos: Bloco[] = (j.blocos || []).filter((b: any) => b && b.en).map((b: any, i: number) => ({ id: b.id || id + "b" + (i + 1), en: String(b.en), pt: String(b.pt || ""), ...(b.dica ? { dica: String(b.dica) } : {}) }));
  if (!blocos.length) throw new Error("A aula precisa ter pelo menos um bloco (frase).");
  return {
    id, ordem, extra: !!j.extra,
    titulo: String(j.titulo || "Aula nova"), resumo: String(j.resumo || ""), estruturas: j.estruturas ? String(j.estruturas) : undefined,
    blocos,
    dialogos: (j.dialogos || []).map((d: any, i: number) => ({
      id: d.id || id + "d" + (i + 1), titulo: String(d.titulo || "Diálogo " + (i + 1)),
      linhas: (d.linhas || []).filter((l: any) => l && l.en).map((l: any) => ({ quem: l.quem === "B" ? "B" : "A", en: String(l.en), pt: String(l.pt || "") }))
    })).filter((d: any) => d.linhas.length),
    cenas: (j.cenas || []).map((c: any, i: number) => ({
      id: c.id || id + "c" + (i + 1), titulo: String(c.titulo || "Cena " + (i + 1)), papel: String(c.papel || "a friendly person"), objetivo: String(c.objetivo || ""),
      blocosAlvo: (c.blocosAlvo || []).map((k: any) => (typeof k === "number" ? blocos[k]?.id : k)).filter(Boolean)
    })),
    diario: (j.diario || []).map(String),
    recontar: (j.recontar || []).map(String),
    criada: hoje()
  } as Aula;
}
