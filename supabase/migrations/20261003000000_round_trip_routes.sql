-- Una ruta es de ida y vuelta: PAC-DAV vale también para DAV-PAC (lib/fleet/rules.ts routeMinutes).
-- 1. Se quita la fila de regreso cuando tiene los mismos minutos que la de ida (se conserva
--    la que va en orden alfabético). Si los minutos difieren, se dejan las dos.
delete from public.flight_routes b
using public.flight_routes a
where a.airline = b.airline
  and a.origin = b.destination and a.destination = b.origin
  and coalesce(a.aircraft_code, '') = coalesce(b.aircraft_code, '')
  and a.estimated_duration_minutes = b.estimated_duration_minutes
  and a.origin < a.destination;

-- 2. Una sola fila por par de aeropuertos y modelo, sin importar el sentido
drop index if exists public.flight_routes_route_model_key;
create unique index if not exists flight_routes_pair_model_key
  on public.flight_routes (airline, least(origin, destination), greatest(origin, destination), coalesce(aircraft_code, ''));

-- 3. Las rutas quedan por revisar: otro administrador debe verificarlas
--    (se confirmaron por error con "Confirmar todos" el 2026-09-25)
update public.flight_routes set verified = false;
