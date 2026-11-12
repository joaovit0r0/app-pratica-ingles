# Treino de Fala

App pessoal para praticar conversação em inglês (nível iniciante), feito para duas pessoas que fazem a mesma aula.
A atividade principal é conversar por voz com a IA (diário falado e roleplay). Em volta disso: blocos prontos com
repetição espaçada, shadowing, recontar 3 vezes, pontos, sequência de dias e conquistas.

- **Front:** React + Vite + TypeScript (pasta `src/`).
- **Banco e login:** Supabase. Uma conta só, compartilhada; dentro dela, um perfil por pessoa, cada um com o próprio progresso.
- **IA:** Google Gemini (plano gratuito) chamado por uma Edge Function do Supabase, que guarda a chave. A chave nunca vai para o navegador.
- **Pronúncia:** um modelo de fonemas (`robg/speako-phoneme-recognizer`, ~355 MB) roda no próprio navegador, num Web Worker.
  Ele ouve os sons que a pessoa produziu e o app compara com a pronúncia do dicionário CMU, som por som.

**Privacidade:** nenhum áudio é salvo nem enviado para servidor nosso. A gravação fica na memória só até a análise
terminar. A conversa usa o reconhecimento de voz do Chrome (que envia o áudio ao Google para virar texto) e só o texto
vai para a IA.

## Estrutura

```
src/
  lib/          estado (store.tsx), regras de progresso, voz, IA, tipos
  pronuncia/    gravação, worker do modelo, comparação de fonemas
  telas/        Hoje, Conversar, Praticar (Blocos, Shadowing, Recontar), Progresso, Aulas, Ajustes
  conteudo/     aulas iniciais (aulas.json) — viram supabase/seed.sql
supabase/
  migrations/   tabelas perfis e aulas, com RLS
  functions/ia  Edge Function que conversa com o Gemini
  seed.sql      aulas iniciais
```

## Como colocar no ar (uma vez)

Você precisa de: Node 22, uma conta no Supabase (projeto criado), uma chave gratuita do Google AI Studio e uma conta no Netlify.

### 1. Banco de dados

No painel do Supabase, abra **SQL Editor** e rode, nesta ordem:

1. o conteúdo de `supabase/migrations/20261112000000_inicial.sql`;
2. o conteúdo de `supabase/seed.sql` (as aulas iniciais).

Ou, pela CLI (dentro desta pasta):

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

e depois rode o `seed.sql` pelo SQL Editor.

### 2. Conta única e fechar cadastros

1. **Authentication → Users → Add user → Create new user**: crie o e-mail e a senha que vocês dois vão usar (marque *Auto Confirm User*).
2. **Authentication → Sign In / Providers**: desligue **Allow new users to sign up**.
   Isso é importante: a chave pública do Supabase fica no site, então sem esse passo qualquer pessoa poderia criar uma conta.

### 3. IA (Edge Function)

```bash
npx supabase secrets set GEMINI_API_KEY=cole_a_chave_aqui
npx supabase functions deploy ia
```

A chave vem do [Google AI Studio](https://aistudio.google.com/apikey) → *Create API key*. Ela fica só no Supabase.

### 4. Rodar no computador

```bash
cp .env.example .env.local   # e preencha com a URL e a chave pública (anon/publishable) do projeto
npm install
npm run dev
```

Os dois valores ficam em **Project Settings → API** (ou **Data API / API Keys**) no Supabase.
Abra o endereço que aparecer (normalmente http://localhost:5173) no **Google Chrome**.

### 5. Publicar no Netlify

1. **Add new site → Import an existing project → GitHub** e escolha este repositório.
2. O `netlify.toml` já define o build (`npm run build`) e a pasta `dist`.
3. Em **Site configuration → Environment variables**, crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Faça o deploy. A cada `git push` o site se atualiza sozinho.

## Aulas novas

Na aba **Aulas → Adicionar aula nova**, cole as anotações da aula e a IA monta frases, diálogos e situações no mesmo
nível. A aula vai para o banco e aparece para os dois perfis. Também dá para colar uma aula pronta em JSON.

Para mudar as aulas iniciais: edite `src/conteudo/aulas.json`, rode `npm run seed` e execute o `supabase/seed.sql` de novo.
Se aparecerem palavras novas, `npm run pronuncias` atualiza o dicionário pequeno de pronúncia (o completo é carregado sob demanda).

## Observações

- Use o Google Chrome (computador ou Android). Safari e Firefox não têm o reconhecimento de voz usado na conversa.
- O modelo de pronúncia baixa uma vez por aparelho (prefira Wi-Fi). Ele não avalia entonação, só os sons.
- Projetos gratuitos do Supabase pausam depois de cerca de uma semana sem uso; é só reativar no painel.
- Dá para importar a cópia de segurança do site antigo (versão em HTML) em **Ajustes → Importar cópia**.
