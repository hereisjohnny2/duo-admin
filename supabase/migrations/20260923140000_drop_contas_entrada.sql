-- O módulo Contas não acompanha entradas/saldo, só saídas (contas a pagar).
alter table public.contas drop column if exists entrada;
