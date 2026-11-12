// Estado global: sessão, aulas, perfis e progresso do perfil atual.
// O progresso é salvo no Supabase com um pequeno atraso (para juntar várias mudanças) e também em cache local.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Aula, Evento, Perfil, Progresso } from "./tipos";
import { normalizar } from "./progresso";
import { lerConfig, salvarConfig } from "./config";

type Toast = { id: number; texto: string; ouro?: boolean };

type Store = {
  sessao: Session | null;
  carregando: boolean;
  erro: string | null;
  aulas: Aula[];
  perfis: Perfil[];
  perfil: Perfil | null;
  escolherPerfil: (id: string | null) => void;
  criarPerfil: (nome: string, cor: string, progresso?: Progresso) => Promise<void>;
  editarPerfil: (id: string, nome: string, cor: string) => Promise<void>;
  excluirPerfil: (id: string) => Promise<void>;
  atualizar: (fn: (p: Progresso) => Evento[] | void) => void;
  recarregarAulas: () => Promise<void>;
  salvarAula: (a: Aula) => Promise<void>;
  removerAula: (id: string) => Promise<void>;
  toasts: Toast[];
  avisar: (texto: string, ouro?: boolean) => void;
  sincronizando: boolean;
};

const Ctx = createContext<Store | null>(null);
export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do Provider");
  return s;
}

function aulaDeLinha(l: { id: string; ordem: number; extra: boolean; conteudo: any }): Aula {
  const c = l.conteudo || {};
  return { blocos: [], dialogos: [], cenas: [], diario: [], recontar: [], ...c, id: l.id, ordem: l.ordem, extra: l.extra };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [perfilId, setPerfilId] = useState<string | null>(lerConfig().perfilAtual);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const pendentes = useRef<Map<string, Progresso>>(new Map());
  const timer = useRef<number | null>(null);

  const avisar = useCallback((texto: string, ouro?: boolean) => {
    const id = Date.now() + Math.random();
    setToasts((t) => t.concat({ id, texto, ouro }));
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ouro ? 2800 : 1500);
  }, []);

  // ---------- sessão ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSessao(data.session); if (!data.session) setCarregando(false); });
    const { data } = supabase.auth.onAuthStateChange((_ev, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const carregarTudo = useCallback(async () => {
    setCarregando(true); setErro(null);
    const [a, p] = await Promise.all([
      supabase.from("aulas").select("id, ordem, extra, conteudo").order("ordem"),
      supabase.from("perfis").select("id, nome, cor, progresso, criado_em, atualizado_em").order("criado_em")
    ]);
    if (a.error || p.error) setErro((a.error || p.error)!.message);
    else {
      setAulas((a.data || []).map(aulaDeLinha));
      setPerfis((p.data || []).map((x: any) => ({ ...x, progresso: normalizar(x.progresso) })));
      try { localStorage.setItem("tf:cache-aulas", JSON.stringify(a.data)); } catch { /* nada */ }
    }
    setCarregando(false);
  }, []);

  useEffect(() => { if (sessao) carregarTudo(); else { setPerfis([]); setAulas([]); } }, [sessao?.user.id, carregarTudo]);

  // ---------- salvar progresso ----------
  const enviar = useCallback(async () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    const itens = Array.from(pendentes.current.entries());
    pendentes.current.clear();
    if (!itens.length) return;
    setSincronizando(true);
    for (const [id, progresso] of itens) {
      const { error } = await supabase.from("perfis").update({ progresso }).eq("id", id);
      if (error) { pendentes.current.set(id, progresso); avisar("Não consegui salvar agora. Vou tentar de novo."); }
    }
    setSincronizando(false);
    if (pendentes.current.size) timer.current = window.setTimeout(enviar, 8000);
  }, [avisar]);

  useEffect(() => {
    const fora = () => { if (document.visibilityState === "hidden") enviar(); else if (!pendentes.current.size && sessao) carregarTudo(); };
    document.addEventListener("visibilitychange", fora);
    window.addEventListener("pagehide", enviar);
    return () => { document.removeEventListener("visibilitychange", fora); window.removeEventListener("pagehide", enviar); };
  }, [enviar, carregarTudo, sessao]);

  const mostrarEventos = useCallback((ev: Evento[]) => {
    for (const e of ev) {
      if (e.tipo === "xp") avisar("+" + e.valor + " XP");
      else if (e.tipo === "meta") avisar("Meta do dia batida! +" + e.valor + " XP de bônus", true);
      else if (e.tipo === "nivel") avisar("Nível " + e.valor + ": " + e.nome, true);
      else if (e.tipo === "conquista") avisar("Conquista: " + e.titulo, true);
      else if (e.tipo === "aviso") avisar(e.texto, e.ouro);
    }
  }, [avisar]);

  // Referência sempre atualizada da lista, para calcular o novo progresso fora do setState
  // (evita contar pontos duas vezes quando o React reexecuta atualizadores).
  const perfisRef = useRef<Perfil[]>([]);
  perfisRef.current = perfis;

  const atualizar = useCallback((fn: (p: Progresso) => Evento[] | void) => {
    const atual = perfisRef.current.find((pf) => pf.id === perfilId);
    if (!atual) return;
    const copia: Progresso = structuredClone(atual.progresso);
    const eventos = fn(copia) || [];
    const novo = { ...atual, progresso: copia };
    perfisRef.current = perfisRef.current.map((pf) => (pf.id === perfilId ? novo : pf));
    setPerfis(perfisRef.current);
    pendentes.current.set(atual.id, copia);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(enviar, 1500);
    mostrarEventos(eventos);
  }, [perfilId, enviar, mostrarEventos]);

  const escolherPerfil = useCallback((id: string | null) => { enviar(); setPerfilId(id); salvarConfig({ perfilAtual: id }); }, [enviar]);

  const criarPerfil = useCallback(async (nome: string, cor: string, progresso?: Progresso) => {
    const { data, error } = await supabase.from("perfis").insert({ nome, cor, progresso: progresso || normalizar(null) }).select("id, nome, cor, progresso, criado_em, atualizado_em").single();
    if (error) throw new Error(error.message);
    setPerfis((l) => l.concat({ ...(data as any), progresso: normalizar((data as any).progresso) }));
    escolherPerfil((data as any).id);
  }, [escolherPerfil]);

  const editarPerfil = useCallback(async (id: string, nome: string, cor: string) => {
    const { error } = await supabase.from("perfis").update({ nome, cor }).eq("id", id);
    if (error) throw new Error(error.message);
    setPerfis((l) => l.map((p) => (p.id === id ? { ...p, nome, cor } : p)));
  }, []);

  const excluirPerfil = useCallback(async (id: string) => {
    const { error } = await supabase.from("perfis").delete().eq("id", id);
    if (error) throw new Error(error.message);
    pendentes.current.delete(id);
    setPerfis((l) => l.filter((p) => p.id !== id));
    if (perfilId === id) escolherPerfil(null);
  }, [perfilId, escolherPerfil]);

  const recarregarAulas = useCallback(async () => {
    const { data, error } = await supabase.from("aulas").select("id, ordem, extra, conteudo").order("ordem");
    if (!error) setAulas((data || []).map(aulaDeLinha));
  }, []);
  const salvarAula = useCallback(async (a: Aula) => {
    const { id, ordem, extra, ...conteudo } = a;
    const { error } = await supabase.from("aulas").upsert({ id, ordem, extra: !!extra, conteudo });
    if (error) throw new Error(error.message);
    await recarregarAulas();
  }, [recarregarAulas]);
  const removerAula = useCallback(async (id: string) => {
    const { error } = await supabase.from("aulas").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await recarregarAulas();
  }, [recarregarAulas]);

  const perfil = useMemo(() => perfis.find((p) => p.id === perfilId) || null, [perfis, perfilId]);

  const valor: Store = {
    sessao, carregando, erro, aulas, perfis, perfil, escolherPerfil, criarPerfil, editarPerfil, excluirPerfil,
    atualizar, recarregarAulas, salvarAula, removerAula, toasts, avisar, sincronizando
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
