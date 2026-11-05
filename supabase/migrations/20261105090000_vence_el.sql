-- Fecha de caducidad del producto (la del lote que vence primero). Opcional:
-- se escribe en la ficha del producto o al registrar una factura.
alter table public.productos
  add column vence_el date;
