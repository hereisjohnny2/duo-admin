-- =====================================================================
-- Migration: módulo Contas (categorias + contas)
-- =====================================================================

create table if not exists public.categorias (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.contas (
  id            uuid primary key default gen_random_uuid(),
  categoria     text not null default '',
  beneficiario  text not null default '',
  identificacao text not null default '',
  vencimento    text not null default '',   -- yyyy-mm-dd
  data_debito   text not null default '',
  saida         text not null default '',
  entrada       text not null default '',
  status        text not null default 'Em Aberto'
                  check (status in ('Em Aberto', 'Pago', 'Atrasado')),
  observacoes   text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists contas_vencimento_idx on public.contas (vencimento);
create index if not exists contas_categoria_idx on public.contas (categoria);

alter table public.categorias enable row level security;
alter table public.contas     enable row level security;

insert into public.categorias (nome) values
  ('Água'),
  ('Anuidade Cartão'),
  ('Caixinha'),
  ('Celular'),
  ('Condomínio'),
  ('Energia'),
  ('Internet'),
  ('IPTU'),
  ('IPVA'),
  ('Limpeza'),
  ('Multa DARF'),
  ('Outros'),
  ('Plano de Saúde'),
  ('Prolabore'),
  ('Salário'),
  ('Simples')
on conflict (nome) do nothing;
