-- Cuánto quiere ganar la tienda en cada producto, como % del precio de venta.
-- Precio = costo / (1 - % / 100). Sin cambiarlo, cada producto busca ganar 30 %.
alter table public.productos
  add column porcentaje_ganancia numeric(5,2) not null default 30
    check (porcentaje_ganancia >= 0 and porcentaje_ganancia < 100);
