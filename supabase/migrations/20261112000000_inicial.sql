-- Estrutura inicial do Treino de Fala.
-- Uma conta (login único, compartilhado) tem vários perfis. Cada perfil guarda o próprio progresso.
-- Nenhum áudio é guardado: só textos, notas e contadores.

create table if not exists public.perfis (
  id uuid primary key default gen_random_uuid(),
  conta uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),
  cor text not null default '#5e2257',
  -- progresso completo do perfil: XP, dias, cartões (repetição espaçada), conquistas, histórico de conversas etc.
  progresso jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists perfis_conta_idx on public.perfis (conta);

create table if not exists public.aulas (
  id text primary key,
  ordem int not null default 100,
  extra boolean not null default false,
  -- titulo, resumo, estruturas, blocos, dialogos, cenas, diario, recontar
  conteudo jsonb not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- atualiza atualizado_em automaticamente
create or replace function public.tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
drop trigger if exists perfis_atualizado on public.perfis;
create trigger perfis_atualizado before update on public.perfis for each row execute function public.tocar_atualizado_em();
drop trigger if exists aulas_atualizado on public.aulas;
create trigger aulas_atualizado before update on public.aulas for each row execute function public.tocar_atualizado_em();

-- Regras de acesso (RLS)
alter table public.perfis enable row level security;
alter table public.aulas enable row level security;

drop policy if exists "perfis da própria conta" on public.perfis;
create policy "perfis da própria conta" on public.perfis
  for all to authenticated
  using (conta = (select auth.uid()))
  with check (conta = (select auth.uid()));

drop policy if exists "aulas: leitura para quem entrou" on public.aulas;
create policy "aulas: leitura para quem entrou" on public.aulas
  for select to authenticated using (true);

drop policy if exists "aulas: inclusão para quem entrou" on public.aulas;
create policy "aulas: inclusão para quem entrou" on public.aulas
  for insert to authenticated with check (true);

drop policy if exists "aulas: edição para quem entrou" on public.aulas;
create policy "aulas: edição para quem entrou" on public.aulas
  for update to authenticated using (true) with check (true);

drop policy if exists "aulas: remoção de aulas extras" on public.aulas;
create policy "aulas: remoção de aulas extras" on public.aulas
  for delete to authenticated using (true);

grant select, insert, update, delete on public.perfis to authenticated;
grant select, insert, update, delete on public.aulas to authenticated;
