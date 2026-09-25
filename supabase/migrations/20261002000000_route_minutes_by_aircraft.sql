-- Minutos de vuelo por ruta Y modelo: un C-208 tarda más que un DH8D en el mismo trayecto.
-- aircraft_code vacío = vale para cualquier modelo (las rutas que ya existen quedan así);
-- una fila con modelo tiene prioridad sobre la genérica.
alter table public.flight_routes
  add column if not exists aircraft_code text references public.aircraft_types (aircraft_code) on update cascade;

alter table public.flight_routes
  drop constraint if exists flight_routes_route_key;

-- Una sola fila por ruta y modelo (y una sola genérica por ruta)
create unique index if not exists flight_routes_route_model_key
  on public.flight_routes (airline, origin, destination, coalesce(aircraft_code, ''));
