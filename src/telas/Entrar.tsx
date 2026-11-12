// Login único, compartilhado pelos dois perfis. Depois de entrar, cada pessoa escolhe o próprio perfil.
import { useState } from "react";
import { supabase } from "../lib/supabase";

export function Entrar() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) setErro(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
  }
  return (
    <div className="stack-lg">
      <div className="stack">
        <h2>Entrar</h2>
        <p className="muted">Use a conta do Treino de Fala. Ela é a mesma para os dois perfis; o progresso de cada um fica separado.</p>
      </div>
      <form className="card" onSubmit={entrar}>
        <label className="campo" htmlFor="email">E-mail<input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="campo" htmlFor="senha">Senha<input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></label>
        {erro ? <p className="small erro">{erro}</p> : null}
        <button className="btn cheio" type="submit" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
        <p className="small muted">Neste aparelho você continua conectado até tocar em "Sair da conta" nos Ajustes.</p>
      </form>
    </div>
  );
}
