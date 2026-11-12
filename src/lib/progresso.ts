// Regras de progresso: pontos, níveis, sequência, repetição espaçada e conquistas.
// Funções puras sobre o objeto Progresso (mutam a cópia que a store entrega).
import type { Aula, Bloco, Cartao, Dia, Evento, Nivel, Progresso } from "./tipos";
import { hoje, somarDias } from "./datas";

export function progressoVazio(): Progresso {
  return {
    xp: 0, metaDiaria: 120, dias: {}, cartoes: {}, conquistas: {}, shadowing: {}, recontar: [], conversas: [], blocosPessoais: [],
    totais: { frases: 0, segundosFala: 0, palavras: 0, turnos: 0, diarios: 0, linhasShadow: 0 }
  };
}
export function normalizar(p: Partial<Progresso> | null | undefined): Progresso {
  const v = progressoVazio();
  const out = Object.assign(v, p || {});
  out.totais = Object.assign(progressoVazio().totais, (p && p.totais) || {});
  return out;
}

export function dia(p: Progresso, d: string = hoje()): Dia {
  if (!p.dias[d]) p.dias[d] = { xp: 0, segundos: 0, frases: 0, missao: {} };
  p.dias[d].missao = p.dias[d].missao || {};
  return p.dias[d];
}
export function diaLeitura(p: Progresso, d: string = hoje()): Dia {
  return p.dias[d] || { xp: 0, segundos: 0, frases: 0, missao: {} };
}

export function sequencia(p: Progresso): number {
  const meta = Math.max(20, Math.round(p.metaDiaria / 4));
  let d = hoje();
  let n = 0;
  if (!(p.dias[d] && p.dias[d].xp >= meta)) d = somarDias(d, -1);
  while (p.dias[d] && p.dias[d].xp >= meta) { n++; d = somarDias(d, -1); }
  return n;
}
export function bonusSequencia(p: Progresso): number { return Math.min(0.5, sequencia(p) * 0.1); }

export function nivelDe(xp: number) {
  let nivel = 1, resto = xp, custo = 150;
  while (resto >= custo) { resto -= custo; nivel++; custo += 50; }
  return { nivel, atual: resto, proximo: custo };
}
const NOMES_NIVEL = ["Primeiras palavras", "Quebrando o gelo", "Conversa curta", "Bate-papo", "Contador de histórias", "Conversa solta", "Falante confiante", "Fluência à vista"];
export function nomeNivel(n: number): string { return NOMES_NIVEL[Math.min(n - 1, NOMES_NIVEL.length - 1)]; }

export function ganharXP(p: Progresso, base: number): Evento[] {
  const nivelAntes = nivelDe(p.xp).nivel;
  const d = dia(p);
  const metaAntes = d.xp >= p.metaDiaria;
  const total = Math.round(base * (1 + bonusSequencia(p)));
  p.xp += total; d.xp += total;
  const ev: Evento[] = [{ tipo: "xp", valor: total }];
  if (!metaAntes && d.xp >= p.metaDiaria) { p.xp += 30; d.xp += 30; ev.push({ tipo: "meta", valor: 30 }); }
  const nivelDepois = nivelDe(p.xp).nivel;
  if (nivelDepois > nivelAntes) ev.push({ tipo: "nivel", valor: nivelDepois, nome: nomeNivel(nivelDepois) });
  for (const c of verificarConquistas(p)) ev.push({ tipo: "conquista", titulo: c.titulo });
  return ev;
}

export function registrarFala(p: Progresso, segundos: number, palavras: number) {
  const d = dia(p);
  d.segundos += Math.round(segundos);
  p.totais.segundosFala += Math.round(segundos);
  p.totais.palavras += palavras || 0;
}

// Missão do dia: conversa + blocos + shadowing dá bônus de 50 XP.
export function completarPasso(p: Progresso, chave: "conversa" | "blocos" | "shadowing" | "recontar"): Evento[] {
  const d = dia(p);
  if (d.missao[chave]) return [];
  d.missao[chave] = true;
  if (!d.missao.bau && d.missao.conversa && d.missao.blocos && d.missao.shadowing) {
    d.missao.bau = true;
    return [{ tipo: "aviso", texto: "Missão do dia completa!", ouro: true } as Evento].concat(ganharXP(p, 50));
  }
  return [];
}

// ---------- repetição espaçada (SM-2 simplificado) ----------
export function revisarCartao(p: Progresso, id: string, nivel: Nivel, nota: number) {
  const c: Cartao = p.cartoes[id] || { reps: 0, intervalo: 0, facilidade: 2.5, revisao: hoje(), historico: [] };
  if (nivel === "bad") { c.reps = 0; c.intervalo = 0; c.facilidade = Math.max(1.3, c.facilidade - 0.2); }
  else {
    c.reps += 1;
    c.facilidade = nivel === "mid" ? Math.max(1.3, c.facilidade - 0.08) : Math.min(3, c.facilidade + 0.05);
    if (c.reps === 1) c.intervalo = 1;
    else if (c.reps === 2) c.intervalo = nivel === "ok" ? 3 : 2;
    else c.intervalo = Math.round(c.intervalo * (nivel === "ok" ? c.facilidade : 1.3));
  }
  c.revisao = somarDias(hoje(), c.intervalo);
  c.historico = (c.historico || []).concat([{ d: hoje(), nota }]).slice(-12);
  p.cartoes[id] = c;
  p.totais.frases += 1;
  dia(p).frases += 1;
}
export type EstadoCartao = "novo" | "revisar" | "aprendendo" | "dominado";
export function estadoCartao(p: Progresso, id: string): EstadoCartao {
  const c = p.cartoes[id];
  if (!c) return "novo";
  if (c.intervalo >= 14) return "dominado";
  if (c.revisao <= hoje()) return "revisar";
  return "aprendendo";
}
export function todosBlocos(aulas: Aula[]): Bloco[] {
  const l: Bloco[] = [];
  for (const a of aulas) for (const b of a.blocos || []) l.push({ ...b, aula: a.id, aulaTitulo: a.titulo });
  return l;
}
export function filaDoDia(p: Progresso, aulas: Aula[], limiteNovos = 5): Bloco[] {
  const todos = todosBlocos(aulas).concat(p.blocosPessoais);
  const vencidos = todos.filter((b) => p.cartoes[b.id] && p.cartoes[b.id].revisao <= hoje());
  vencidos.sort((a, b) => (p.cartoes[a.id].revisao < p.cartoes[b.id].revisao ? -1 : 1));
  const novos = todos.filter((b) => !p.cartoes[b.id]).slice(0, limiteNovos);
  return vencidos.concat(novos);
}
export function adicionarBlocoPessoal(p: Progresso, en: string, pt: string, origem: string): Bloco {
  const ja = p.blocosPessoais.find((b) => b.en.trim().toLowerCase() === en.trim().toLowerCase());
  if (ja) return ja;
  const b: Bloco = { id: "bp" + Date.now().toString(36) + Math.floor(Math.random() * 1000), en, pt, aula: "pessoal", aulaTitulo: "Minhas frases", origem };
  p.blocosPessoais.push(b);
  return b;
}
export function contarDominados(p: Progresso): number {
  return Object.values(p.cartoes).filter((c) => c.intervalo >= 14).length;
}

// ---------- conquistas ----------
export const CONQUISTAS: { id: string; titulo: string; desc: string; teste: (p: Progresso) => boolean }[] = [
  { id: "primeira-conversa", titulo: "Primeira conversa", desc: "Termine uma conversa com a IA", teste: (p) => p.conversas.length >= 1 },
  { id: "diario-3", titulo: "Diário em dia", desc: "Faça 3 diários falados", teste: (p) => p.totais.diarios >= 3 },
  { id: "turnos-50", titulo: "Falador", desc: "Fale 50 vezes em conversas", teste: (p) => p.totais.turnos >= 50 },
  { id: "seq-3", titulo: "3 dias seguidos", desc: "Pratique 3 dias sem parar", teste: (p) => sequencia(p) >= 3 },
  { id: "seq-7", titulo: "Semana completa", desc: "Pratique 7 dias seguidos", teste: (p) => sequencia(p) >= 7 },
  { id: "seq-30", titulo: "Um mês firme", desc: "Pratique 30 dias seguidos", teste: (p) => sequencia(p) >= 30 },
  { id: "blocos-10", titulo: "10 blocos dominados", desc: "Leve 10 frases a 2 semanas de intervalo", teste: (p) => contarDominados(p) >= 10 },
  { id: "blocos-30", titulo: "30 blocos dominados", desc: "Leve 30 frases a 2 semanas de intervalo", teste: (p) => contarDominados(p) >= 30 },
  { id: "shadow-5", titulo: "Eco", desc: "Complete 5 diálogos no shadowing", teste: (p) => Object.values(p.shadowing).reduce((s, x) => s + x.vezes, 0) >= 5 },
  { id: "som-90", titulo: "Ouvido afiado", desc: "Tire 90% ou mais na pronúncia de um diálogo inteiro", teste: (p) => Object.values(p.shadowing).some((x) => x.melhor >= 90) },
  { id: "recontar-mais", titulo: "Mais rápido", desc: "Fale 20% mais palavras por minuto na última rodada do recontar", teste: (p) => p.recontar.some((r) => r.ganho >= 20) },
  { id: "fala-30", titulo: "30 minutos falando", desc: "Some 30 minutos de fala no total", teste: (p) => p.totais.segundosFala >= 1800 },
  { id: "fala-120", titulo: "2 horas falando", desc: "Some 2 horas de fala no total", teste: (p) => p.totais.segundosFala >= 7200 },
  { id: "nivel-5", titulo: "Nível 5", desc: "Chegue ao nível 5", teste: (p) => nivelDe(p.xp).nivel >= 5 }
];
export function verificarConquistas(p: Progresso) {
  const novas: typeof CONQUISTAS = [];
  for (const c of CONQUISTAS) if (!p.conquistas[c.id] && c.teste(p)) { p.conquistas[c.id] = hoje(); novas.push(c); }
  return novas;
}

// Converte a cópia de segurança do site antigo (versão em HTML) para perfis.
export function importarCopiaAntiga(dump: any): { nome: string; cor: string; progresso: Progresso }[] {
  if (!dump || !Array.isArray(dump.perfis)) throw new Error("Arquivo de cópia inválido.");
  return dump.perfis.map((pf: any) => {
    const d = (dump.dados && dump.dados[pf.id]) || {};
    const { id, nome, cor, criado, ...resto } = d;
    return { nome: pf.nome, cor: pf.cor, progresso: normalizar(resto) };
  });
}
