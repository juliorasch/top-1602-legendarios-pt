-- Daily Rasch — cache de sessão OAuth do iziBizi
--
-- Apenas o service role tem acesso. O acesso à API do iziBizi é feito
-- exclusivamente via edge functions; o frontend nunca toca neste
-- registo (e por isso não há policy para 'authenticated').
--
-- Único registo (id = 1) — refrescado conforme expira.

create table public.izibizi_session (
  id int primary key default 1,
  access_token text not null,
  refresh_token text,
  fiscal_year_token text,
  fiscal_year_id text,
  expires_at timestamptz not null,
  fiscal_year_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

alter table public.izibizi_session enable row level security;

-- Sem policy para 'authenticated' → utilizadores normais não conseguem
-- ler. O service role usado pelas edge functions ignora RLS.
