export type Bloco = { id: string; en: string; pt: string; dica?: string; aula?: string; aulaTitulo?: string; origem?: string };
export type Linha = { quem: "A" | "B"; en: string; pt: string };
export type Dialogo = { id: string; titulo: string; linhas: Linha[] };
export type Cena = { id: string; titulo: string; papel: string; objetivo: string; blocosAlvo: string[] };
export type Aula = {
  id: string; ordem: number; extra?: boolean; titulo: string; resumo?: string; estruturas?: string;
  blocos: Bloco[]; dialogos: Dialogo[]; cenas: Cena[]; diario: string[]; recontar: string[]; criada?: string;
};

export type Cartao = { reps: number; intervalo: number; facilidade: number; revisao: string; historico: { d: string; nota: number }[] };
export type Dia = { xp: number; segundos: number; frases: number; missao: Record<string, boolean> };
export type Correcao = { said: string; better: string; why_pt?: string };
export type Conversa = { id?: string; data: string; modo: "diario" | "cena"; cena: string | null; titulo: string; turnos: number; palavras: number; correcoes: Correcao[]; fluencia: number | null };
export type Recontar = { data: string; tema: string; modo: string; wpm: number[]; ganho: number };
export type Totais = { frases: number; segundosFala: number; palavras: number; turnos: number; diarios: number; linhasShadow: number };

export type Progresso = {
  xp: number;
  metaDiaria: number;
  dias: Record<string, Dia>;
  cartoes: Record<string, Cartao>;
  conquistas: Record<string, string>;
  shadowing: Record<string, { vezes: number; melhor: number; ultima?: string }>;
  recontar: Recontar[];
  conversas: Conversa[];
  blocosPessoais: Bloco[];
  totais: Totais;
};

export type Perfil = { id: string; nome: string; cor: string; progresso: Progresso; criado_em?: string; atualizado_em?: string };

export type Nivel = "ok" | "mid" | "bad";

export type Evento =
  | { tipo: "xp"; valor: number }
  | { tipo: "meta"; valor: number }
  | { tipo: "nivel"; valor: number; nome: string }
  | { tipo: "conquista"; titulo: string }
  | { tipo: "aviso"; texto: string; ouro?: boolean };
