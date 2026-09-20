-- =====================================================================
-- Migration: módulo Inventário (estoque do galpão)
-- Banco: PostgreSQL (Supabase)
-- Cria a tabela public.inventario_itens e carrega a lista inicial
-- de 163 itens. O seed é idempotente: só insere se a tabela estiver vazia.
-- =====================================================================

create table if not exists public.inventario_itens (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique,
  produto         text not null,
  categoria       text not null
                    check (categoria in ('Acabamento', 'Concreto', 'Construção', 'Elétrica', 'EPI', 'Estrutura', 'Ferragem', 'Ferramenta', 'Fixação', 'Hidráulica', 'Parafuso', 'Pintura', 'Uniforme')),
  quantidade      numeric not null default 0 check (quantidade >= 0),
  unidade         text not null default 'un'
                    check (unidade in ('un', 'cx', 'par', 'pct', 'rol', 'pcs', 'm', 'kg', 'L', 'sc')),
  estoque_minimo  numeric not null default 0 check (estoque_minimo >= 0),
  localizacao     text not null default '',
  observacoes     text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists inventario_itens_categoria_idx on public.inventario_itens (categoria);
create index if not exists inventario_itens_produto_idx   on public.inventario_itens (produto);

-- RLS habilitado (mesma política dos demais módulos): o app acessa via
-- SERVICE ROLE no servidor, que ignora RLS. Sem políticas públicas, a chave
-- anônima não lê nada.
alter table public.inventario_itens enable row level security;

-- Mantém updated_at em dia a cada alteração de quantidade/estoque.
create or replace function public.inventario_itens_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists inventario_itens_set_updated_at on public.inventario_itens;
create trigger inventario_itens_set_updated_at
  before update on public.inventario_itens
  for each row execute function public.inventario_itens_touch_updated_at();

-- ---------------------------------------------------------------------
-- Seed: inventário levantado no galpão DUO.
-- ---------------------------------------------------------------------
do $$
begin
  if (select count(*) from public.inventario_itens) = 0 then
    insert into public.inventario_itens (codigo, produto, categoria, quantidade, unidade, estoque_minimo, localizacao, observacoes) values
    ('ACB-001', 'Acabamento para registro', 'Acabamento', 1, 'un', 1, '', ''),
    ('ACB-002', 'Anel de vedação', 'Acabamento', 1, 'un', 1, '', ''),
    ('ACB-003', 'Apoio PCD', 'Acabamento', 2, 'un', 1, '', ''),
    ('ACB-004', 'Cantoneira de canto para gesso', 'Acabamento', 6, 'un', 1, '', ''),
    ('ACB-005', 'Cola rodapé', 'Acabamento', 1, 'un', 1, '', ''),
    ('ACB-006', 'DRY PAPEL FITA DE PAPEL', 'Acabamento', 8.5, 'rol', 1, '', ''),
    ('ACB-007', 'Engate Flexivel 30 Cm', 'Acabamento', 8, 'un', 1, '', ''),
    ('ACB-008', 'Fechadura Interna Bico de Papagaio', 'Acabamento', 1, 'cx', 1, '', ''),
    ('ACB-009', 'Ligação Flexivel aço 40 CM', 'Acabamento', 2, 'un', 1, '', ''),
    ('ACB-010', 'Lubrificante Antecorrosivo', 'Acabamento', 1, 'un', 1, '', ''),
    ('ACB-011', 'Massa Vedante para Telha', 'Acabamento', 3, 'un', 1, '', ''),
    ('ACB-012', 'Multiuso Eletroduto e Canaleta', 'Acabamento', 2, 'un', 1, '', ''),
    ('ACB-013', 'PU Branco', 'Acabamento', 1, 'un', 1, '', ''),
    ('ACB-014', 'PU Preto', 'Acabamento', 4, 'un', 1, '', ''),
    ('ACB-015', 'Ralo', 'Acabamento', 14, 'un', 1, '', ''),
    ('ACB-016', 'Rejunte Cinza', 'Acabamento', 6, 'pct', 1, '', ''),
    ('ACB-017', 'Silicone', 'Acabamento', 3, 'un', 1, '', ''),
    ('ACB-018', 'Tela de fibra de vidro - tela para reboco', 'Acabamento', 5, 'rol', 1, '', ''),
    ('CCR-001', 'Manilha de concreto (sem tampa) - unidade menor', 'Concreto', 1, 'un', 1, '', ''),
    ('CCR-002', 'Manilha de concreto — unidade maior', 'Concreto', 3, 'un', 1, '', ''),
    ('CON-001', 'Andaime', 'Construção', 4, 'un', 1, '', ''),
    ('CON-002', 'Arame', 'Construção', 3, 'rol', 1, '', ''),
    ('CON-003', 'Arame recozido', 'Construção', 1, 'rol', 1, '', ''),
    ('CON-004', 'Betoneira', 'Construção', 1, 'un', 1, '', ''),
    ('CON-005', 'Disco para Metal', 'Construção', 3, 'un', 1, '', ''),
    ('CON-006', 'Disco Para Piso', 'Construção', 1, 'un', 1, '', ''),
    ('CON-007', 'Espaçador Estrela preto', 'Construção', 1, 'cx', 1, '', ''),
    ('CON-008', 'Espaçador vermelho', 'Construção', 1, 'cx', 1, '', ''),
    ('CON-009', 'Espuma', 'Construção', 5, 'rol', 1, '', ''),
    ('CON-010', 'Espuma Expansiva', 'Construção', 2, 'un', 1, '', ''),
    ('CON-011', 'Fibra Sisal', 'Construção', 1, 'pct', 1, '', ''),
    ('CON-012', 'Isopor', 'Construção', 11, 'un', 1, '', ''),
    ('CON-013', 'Parafuso Sext Telha Termoacústico', 'Construção', 16, 'cx', 1, '', ''),
    ('CON-014', 'Porcelanato 60x120', 'Construção', 10, 'cx', 1, '', ''),
    ('CON-015', 'Porcelanato 90x90', 'Construção', 6.5, 'cx', 1, '', ''),
    ('CON-016', 'Porta Borca 110mm', 'Construção', 2, 'un', 1, '', ''),
    ('CON-017', 'Porta Broca 30 mm', 'Construção', 1, 'un', 1, '', ''),
    ('CON-018', 'Porta Broca 350 mm', 'Construção', 2, 'un', 1, '', ''),
    ('CON-019', 'Porta Broca 35mm', 'Construção', 1, 'un', 1, '', ''),
    ('CON-020', 'Porta Broca 40 MM', 'Construção', 1, 'un', 1, '', ''),
    ('CON-021', 'Porta Broca 50 mm', 'Construção', 1, 'un', 1, '', ''),
    ('CON-022', 'Porta Broca 65mm', 'Construção', 1, 'un', 1, '', ''),
    ('CON-023', 'Prego de Aço 15x15', 'Construção', 3, 'cx', 1, '', ''),
    ('CON-024', 'Protetor para portão PVC 50M X 7CM', 'Construção', 1, 'rol', 1, '', ''),
    ('CON-025', 'Rejunte Cinza', 'Construção', 1, 'un', 1, '', ''),
    ('CON-026', 'Serra Copo 40 mm', 'Construção', 1, 'un', 1, '', ''),
    ('CON-027', 'Tela em Fibra de Vidro', 'Construção', 35, 'rol', 1, '', ''),
    ('CON-028', 'Tela Vertex L 100MM X C 50M', 'Construção', 15.5, 'rol', 1, '', ''),
    ('EPI-001', 'Botina preta - tam.42', 'EPI', 1, 'par', 1, '', ''),
    ('EPI-002', 'Capa PVC - amarelo - tam. G', 'EPI', 4, 'un', 1, '', ''),
    ('EPI-003', 'Capacete', 'EPI', 12, 'un', 1, '', ''),
    ('EPI-004', 'Chápeu', 'EPI', 2, 'un', 1, '', ''),
    ('EPI-005', 'Cinto de segurança', 'EPI', 2, 'un', 1, '', ''),
    ('EPI-006', 'Colete sinalização', 'EPI', 4, 'un', 1, '', ''),
    ('EPI-007', 'Kit 10 Jugular Capacete', 'EPI', 20, 'un', 1, '', ''),
    ('EPI-008', 'Luvas', 'EPI', 10, 'par', 1, '', ''),
    ('EPI-009', 'Mascara', 'EPI', 3, 'un', 1, '', ''),
    ('EPI-010', 'Protetor Auricular', 'EPI', 30, 'par', 1, '', ''),
    ('EPI-011', 'Suporte para Capacete', 'EPI', 8, 'un', 1, '', ''),
    ('EPI-012', 'Uniforme Profissional tam.GG', 'EPI', 2, 'un', 1, '', ''),
    ('EPI-013', 'Vestimenta de proteção química - tam. XG', 'EPI', 14, 'un', 1, '', ''),
    ('EPI-014', 'Óculos', 'EPI', 6, 'un', 1, '', ''),
    ('ELE-001', 'Braçadeira metálica em ''U''', 'Elétrica', 1, 'un', 1, '', ''),
    ('ELE-002', 'Braçadeira plástica para eletroduto 3/4"', 'Elétrica', 3, 'un', 1, '', ''),
    ('ELE-003', 'Conduíte corrugado (eletroduto flexível) — diversos', 'Elétrica', 1, 'un', 1, '', ''),
    ('ELE-004', 'Conduíte corrugado — eletroduto flexível', 'Elétrica', 1, 'un', 1, '', ''),
    ('ELE-005', 'Conduíte corrugado — rolo (eletroduto flexível)', 'Elétrica', 1, 'un', 1, '', ''),
    ('ELE-006', 'Conexão horizontal de eletrocalha galvanizada', 'Elétrica', 13, 'un', 1, '', ''),
    ('ELE-007', 'Conexão prensa-cabo (com orelha de fixação)', 'Elétrica', 1, 'un', 1, '', ''),
    ('ELE-008', 'Curva longa de PVC preto roscável (eletroduto rígido)', 'Elétrica', 10, 'un', 1, '', ''),
    ('ELE-009', 'Eletrocalha galvanizada (rasgos largos transversais)', 'Elétrica', 12, 'un', 1, '', ''),
    ('ELE-010', 'Eletrocalha metálica perfurada', 'Elétrica', 6, 'un', 1, '', ''),
    ('ELE-011', 'Eletrocalha perfurada galvanizada', 'Elétrica', 4, 'un', 1, '', ''),
    ('ELE-012', 'Eletrocalhas e conexões/curvas galvanizadas', 'Elétrica', 15, 'cx', 1, '', ''),
    ('ELE-013', 'Eletroduto rígido preto roscável', 'Elétrica', 3, 'un', 1, '', ''),
    ('ELE-014', 'Emenda de eletrocalha perfurada', 'Elétrica', 4, 'un', 1, '', ''),
    ('ELE-015', 'Luva de emenda para eletroduto metálico — ref. 56131/002', 'Elétrica', 4, 'un', 1, '', ''),
    ('ELE-016', 'Luva de emenda para eletroduto metálico — ref. 56131025', 'Elétrica', 3, 'un', 1, '', ''),
    ('ELE-017', 'Lâmpada de Emergencia', 'Elétrica', 5, 'un', 1, '', ''),
    ('ELE-018', 'Niple / luva roscável preta (eletroduto rígido)', 'Elétrica', 7, 'un', 1, '', ''),
    ('ELE-019', 'Painel Embutir', 'Elétrica', 1, 'un', 1, '', ''),
    ('ELE-020', 'Placa 4x2 Postos c/suporte branco', 'Elétrica', 1, 'cx', 1, '', ''),
    ('ELE-021', 'Placa cega branca — ref. ST340CB (espelho 4x2)', 'Elétrica', 3, 'un', 1, '', ''),
    ('ELE-022', 'Refletor LED à bateria', 'Elétrica', 1, 'un', 1, '', ''),
    ('ELE-023', 'Spot de Sobrepor', 'Elétrica', 2, 'un', 1, '', ''),
    ('ELE-024', 'Suporte / mão-francesa para eletrocalha', 'Elétrica', 9, 'un', 1, '', ''),
    ('ELE-025', 'Suporte metálico em ''L'' comprido', 'Elétrica', 3, 'un', 1, '', ''),
    ('EST-001', 'Cantoneira perfurada galvanizada', 'Estrutura', 3, 'un', 1, '', ''),
    ('EST-002', 'Perfil / barra metálica galvanizada (guia ou perfil ''U'')', 'Estrutura', 13, 'un', 1, '', ''),
    ('EST-003', 'Perfil / guia metálica perfurada com graduação', 'Estrutura', 4, 'un', 1, '', ''),
    ('EST-004', 'Perfil metálico embalado em plástico', 'Estrutura', 2, 'un', 1, '', ''),
    ('EST-005', 'Poste metálico galvanizado perfurado', 'Estrutura', 4, 'un', 1, '', ''),
    ('EST-006', 'Travessa 1.250 MM', 'Estrutura', 50, 'pcs', 1, '', ''),
    ('FRG-001', 'Armadura de pilar em ferro ferragem CA-50/CA-60', 'Ferragem', 1, 'un', 1, '', ''),
    ('FRM-001', 'Serra copo (broca copo) — aço', 'Ferramenta', 1, 'un', 1, '', ''),
    ('FIX-001', 'Barras roscadas galvanizadas (hastes rosqueadas)', 'Fixação', 24, 'un', 1, '', ''),
    ('FIX-002', 'Cantoneira ''L'' - galvanizada', 'Fixação', 1, 'un', 1, '', ''),
    ('FIX-003', 'Chumbador tipo parabolt', 'Fixação', 98, 'un', 1, '', ''),
    ('FIX-004', 'Cinta / tira de chapa galvanizada lisa (rolo)', 'Fixação', 1, 'un', 1, '', ''),
    ('FIX-005', 'Clip metálico de fixação (chapa recortada) — modelo 2', 'Fixação', 1, 'un', 1, '', ''),
    ('FIX-006', 'Espaçadores plásticas de fixação', 'Fixação', 0.5, 'cx', 1, '', ''),
    ('FIX-007', 'Fita perfurada galvanizada', 'Fixação', 1, 'rol', 1, '', ''),
    ('FIX-008', 'Hastes galvanizadas dobradas em ''U''', 'Fixação', 18, 'un', 1, '', ''),
    ('FIX-009', 'Presilha / clip metálico de fixação (chapa recortada)', 'Fixação', 3, 'un', 1, '', ''),
    ('FIX-010', 'Rolo de arame galvanizado (arame recozido/galvanizado)', 'Fixação', 3, 'un', 1, '', ''),
    ('HID-001', 'Bucha de plástico - branco', 'Hidráulica', 7, 'un', 1, '', ''),
    ('HID-002', 'Canaleta de drenagem plástica (preta)', 'Hidráulica', 12, 'un', 1, '', ''),
    ('HID-003', 'Cano de 100', 'Hidráulica', 1, 'un', 1, '', ''),
    ('HID-004', 'Cano Y - 50mm', 'Hidráulica', 1, 'un', 1, '', ''),
    ('HID-005', 'Cano Y - 90° 40mm', 'Hidráulica', 2, 'un', 1, '', ''),
    ('HID-006', 'Cola para Cano (acabando...)', 'Hidráulica', 1, 'un', 1, '', ''),
    ('HID-007', 'Conexão 75', 'Hidráulica', 4, 'un', 1, '', ''),
    ('HID-008', 'Conexões de PVC branco para esgoto', 'Hidráulica', 14, 'un', 1, '', ''),
    ('HID-009', 'Curva - 100mm', 'Hidráulica', 6, 'un', 1, '', ''),
    ('HID-010', 'Curva - 25mm', 'Hidráulica', 8, 'un', 1, '', ''),
    ('HID-011', 'Curva 90° - 3/4', 'Hidráulica', 5, 'un', 1, '', ''),
    ('HID-012', 'Joelho 45° 40MM', 'Hidráulica', 2, 'un', 1, '', ''),
    ('HID-013', 'Joelho 45°25mm', 'Hidráulica', 5, 'un', 1, '', ''),
    ('HID-014', 'Joelho 50 mm', 'Hidráulica', 4, 'un', 1, '', ''),
    ('HID-015', 'Joelho 75 mm', 'Hidráulica', 4, 'un', 1, '', ''),
    ('HID-016', 'Joelho 90° 40mm', 'Hidráulica', 1, 'un', 1, '', ''),
    ('HID-017', 'Joelho 90° de PVC branco (soldável)', 'Hidráulica', 4, 'un', 1, '', ''),
    ('HID-018', 'Joelho 90°50MM', 'Hidráulica', 1, 'un', 1, '', ''),
    ('HID-019', 'Joelho Azul', 'Hidráulica', 2, 'un', 1, '', ''),
    ('HID-020', 'Junta 40mm', 'Hidráulica', 16, 'un', 1, '', ''),
    ('HID-021', 'Junção simples / TÊ sanitário de PVC branco (esgoto)', 'Hidráulica', 4, 'un', 1, '', ''),
    ('HID-022', 'Junção Y 45° de PVC branco esgoto DN100', 'Hidráulica', 3, 'un', 1, '', ''),
    ('HID-023', 'Luva de PVC branco (soldável)', 'Hidráulica', 11, 'un', 1, '', ''),
    ('HID-024', 'Macaco Hidraulico', 'Hidráulica', 2, 'un', 1, '', ''),
    ('HID-025', 'Redução 50 mm', 'Hidráulica', 1, 'un', 1, '', ''),
    ('HID-026', 'Redução 50x 40', 'Hidráulica', 3, 'un', 1, '', ''),
    ('HID-027', 'Refil filtrante de água - ''PURE FLOW''', 'Hidráulica', 1, 'un', 1, '', ''),
    ('HID-028', 'Sifão para Lavatorio', 'Hidráulica', 16, 'un', 1, '', ''),
    ('HID-029', 'Sifão para Tanque/ Pia', 'Hidráulica', 1, 'un', 1, '', ''),
    ('HID-030', 'T 50MM', 'Hidráulica', 1, 'un', 1, '', ''),
    ('HID-031', 'T 50MM', 'Hidráulica', 2, 'un', 1, '', ''),
    ('HID-032', 'T 50MM', 'Hidráulica', 3, 'un', 1, '', ''),
    ('HID-033', 'T 75', 'Hidráulica', 2, 'un', 1, '', ''),
    ('HID-034', 'Valvula Mic PRD', 'Hidráulica', 3, 'un', 1, '', ''),
    ('PAR-001', 'Bucha - 7mm', 'Parafuso', 100, 'un', 1, '', ''),
    ('PAR-002', 'Caixa para parafuso', 'Parafuso', 13, 'un', 1, '', ''),
    ('PAR-003', 'Parafuso Autoperfurantes Cab. Chata com Asa 4.2x32', 'Parafuso', 19, 'cx', 1, '', ''),
    ('PAR-004', 'Parafuso Autoperfurantes Cab. Chata com Asa 8x1-1/4', 'Parafuso', 98, 'un', 1, '', ''),
    ('PAR-005', 'Parafuso Autoperfurantes Cab. Chata Phillips', 'Parafuso', 9.5, 'cx', 1, '', ''),
    ('PAR-006', 'Parafuso Autoperfurantes Cab. Chata Phillips 5.5x 75', 'Parafuso', 1, 'pct', 1, '', ''),
    ('PAR-007', 'Parafuso DryWall Trombeta M3.5X 25', 'Parafuso', 2, 'cx', 1, '', ''),
    ('PAR-008', 'Parafuso Glasroc 3.5x25', 'Parafuso', 14, 'cx', 1, '', ''),
    ('PAR-009', 'Parafuso Sext Ponta Broca 10x19', 'Parafuso', 10, 'cx', 1, '', ''),
    ('PIN-001', 'Acrilico Interior 3L', 'Pintura', 1, 'un', 1, '', ''),
    ('PIN-002', 'Fita Crepe Verde', 'Pintura', 1, 'rol', 1, '', ''),
    ('PIN-003', 'Fita Sinalizadora', 'Pintura', 1, 'rol', 1, '', ''),
    ('PIN-004', 'Junta Rápida 25KG', 'Pintura', 36, 'un', 1, '', ''),
    ('PIN-005', 'Kit Pintura', 'Pintura', 2, 'un', 1, '', ''),
    ('PIN-006', 'Manta Liquida', 'Pintura', 9, 'un', 1, '', ''),
    ('PIN-007', 'Massa Premium Branca (quase acabando..)', 'Pintura', 1, 'un', 1, '', ''),
    ('PIN-008', 'Massa Premium Cinza (quase acabando..)', 'Pintura', 1, 'un', 1, '', ''),
    ('PIN-009', 'Prime Asfáltico', 'Pintura', 1, 'un', 1, '', ''),
    ('PIN-010', 'Proteção Contra Respingo de Tinta 2,7M X 17M', 'Pintura', 2, 'rol', 1, '', ''),
    ('PIN-011', 'Selador', 'Pintura', 4, 'un', 1, '', ''),
    ('PIN-012', 'Semi Brilho 8L', 'Pintura', 1, 'un', 1, '', ''),
    ('PIN-013', 'Xadrez Azul', 'Pintura', 1, 'un', 1, '', ''),
    ('UNI-001', 'Uniforme G', 'Uniforme', 2, 'un', 1, '', ''),
    ('UNI-002', 'Uniforme GG', 'Uniforme', 7, 'un', 1, '', '');
  end if;
end
$$;
