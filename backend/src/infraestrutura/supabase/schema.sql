create table if not exists sessoes (
  id uuid primary key,
  contexto text not null,
  ciclos_completados integer not null,
  iniciada_em timestamptz not null,
  finalizada_em timestamptz not null,
  duracao_total_seg integer not null,
  playlist_foco text not null,
  playlist_pausa text not null,
  criada_em timestamptz not null default now()
);

-- Acesso é só pelo backend com service role key (que ignora RLS),
-- mas RLS ligado garante que a anon key pública não lê nada.
alter table sessoes enable row level security;
