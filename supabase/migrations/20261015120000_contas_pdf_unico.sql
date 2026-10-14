-- =====================================================================
-- Migration: PDF único por conta (boleto + comprovante juntos)
-- O Storage passa a guardar um só PDF por conta, chamado
-- BOL_<Categoria>_<Beneficiario>+<Identificacao>_<Mes>_<Ano>.pdf.
-- As páginas do boleto vêm primeiro, depois as do comprovante; a
-- quantidade de páginas de cada parte fica aqui para poder trocar ou
-- remover uma parte sem a outra. 0 páginas = parte ausente.
-- =====================================================================

alter table public.contas
  add column if not exists pdf_path             text    not null default '',
  add column if not exists boleto_paginas       integer not null default 0,
  add column if not exists comprovante_paginas  integer not null default 0;

-- Os caminhos por arquivo do modelo anterior deixam de existir
-- (boleto_nome/comprovante_nome continuam: nome original de cada parte).
alter table public.contas
  drop column if exists boleto_path,
  drop column if exists comprovante_path;

-- Só PDFs vão para o bucket agora; o PDF montado pode somar as duas partes.
update storage.buckets
set allowed_mime_types = array['application/pdf'],
    file_size_limit    = 20 * 1024 * 1024
where id = 'contas-arquivos';
