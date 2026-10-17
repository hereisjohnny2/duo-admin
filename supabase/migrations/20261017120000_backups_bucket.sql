-- =====================================================================
-- Migration: bucket das exportações semanais em CSV
-- A rota /api/cron/backup (Vercel Cron) grava um CSV por tabela do app
-- em "<aaaa-mm-dd>/<tabela>.csv" e apaga as pastas com mais de 30 dias.
-- Bucket privado e sem políticas: só o servidor (SERVICE ROLE) lê e grava.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'backups',
  'backups',
  false,
  20 * 1024 * 1024,
  array['text/csv']
)
on conflict (id) do nothing;
