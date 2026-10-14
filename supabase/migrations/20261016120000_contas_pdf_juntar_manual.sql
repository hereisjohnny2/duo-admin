-- =====================================================================
-- Migration: boleto e comprovante só são juntados quando o usuário pede
-- Até clicar em "Juntar", cada parte fica num arquivo próprio no Storage
-- (BOL_... para o boleto, COMP_... para o comprovante). Ao juntar, nasce
-- o PDF único (pdf_path, BOL_...) e os arquivos separados são apagados.
-- Vazio ('') = parte sem arquivo próprio (ausente ou dentro do pdf_path).
-- =====================================================================

alter table public.contas
  add column if not exists boleto_path       text not null default '',
  add column if not exists comprovante_path  text not null default '';
