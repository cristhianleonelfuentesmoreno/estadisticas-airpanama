-- Aviso de "te queda poco": cada producto puede tener su mínimo; sin mínimo la app usa 1.
alter table public.productos
  add column stock_minimo numeric(12,3) check (stock_minimo is null or stock_minimo >= 0);
