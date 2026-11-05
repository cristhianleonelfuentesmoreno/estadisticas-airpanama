-- Arranque del % de ganancia (una sola vez):
-- 1. Con precio y costo: se guarda el % que de verdad ganan hoy. El precio no se toca.
-- 2. Sin precio pero con costo: precio para ganar 30 %, redondeado hacia arriba a 5 centavos
--    (igual que precioParaGanar en lib/tienda/formato.ts).
-- Sin costo no se puede calcular nada: se quedan en 30 % y su precio, si tienen.
update public.productos
set porcentaje_ganancia = round((precio_venta - costo) / precio_venta * 100)
where costo > 0 and precio_venta > costo
  and round((precio_venta - costo) / precio_venta * 100) between 0 and 99;

update public.productos
set precio_venta = ceil(round(costo / (1 - porcentaje_ganancia / 100), 2) * 20 - 1e-9) / 20
where precio_venta is null and costo > 0;
