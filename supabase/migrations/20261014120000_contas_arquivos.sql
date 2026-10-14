-- =====================================================================
-- Migration: arquivos (boleto e comprovante) das contas
-- Os arquivos ficam no bucket privado "contas-arquivos" do Supabase
-- Storage; aqui guardamos o caminho do objeto e o nome original.
-- Vazio ('') = sem arquivo.
-- =====================================================================

alter table public.contas
  add column if not exists boleto_path       text not null default '',
  add column if not exists boleto_nome       text not null default '',
  add column if not exists comprovante_path  text not null default '',
  add column if not exists comprovante_nome  text not null default '';

-- Bucket privado e sem políticas: só o servidor (SERVICE ROLE) lê e grava.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contas-arquivos',
  'contas-arquivos',
  false,
  8 * 1024 * 1024,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;
