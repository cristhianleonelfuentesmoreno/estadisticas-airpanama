-- Base de conocimiento de flota, tripulación y vuelos regulares.
-- Fuente: itinerarios de Air Panama del 21, 22 y 23 de septiembre de 2026
-- y capacidades confirmadas por operaciones (DH8D 74, F-50 50, C-208 12).
-- `verified = false` marca lo que viene de datos viejos y debe revisarse en el panel.

-- ---------------------------------------------------------------------------
-- 1. Modelos de avión (tabla existente, estaba vacía)
-- ---------------------------------------------------------------------------
alter table public.aircraft_types
  add column if not exists aliases text[] not null default '{}',
  add column if not exists verified boolean not null default false;

alter table public.aircraft_types
  add constraint aircraft_types_code_key unique (aircraft_code);

insert into public.aircraft_types (airline, aircraft_code, name, pax_max, aliases, verified) values
  ('Air Panama',    'DH8D',  'De Havilland Dash 8 Q400', 74, '{DH8D,DHC8,Q400,DHBD,DHSD,DH8A}', true),
  ('Air Panama',    'F-50',  'Fokker 50',                50, '{F-50,F50,FK50,F5O,FK5O}',       true),
  ('Air Panama',    'C-208', 'Cessna 208 Caravan',       12, '{C-208,C208,C2O8}',              true),
  ('Air Panama',    'DH8C',  'De Havilland Dash 8-300',   0, '{DH8C}',                         false),
  ('Air Panama',    'DHC6',  'De Havilland Twin Otter',   0, '{DHC6,DHC-6}',                   false),
  ('Copa Airlines', 'B737',  'Boeing 737-700',          124, '{B737}',                         false),
  ('Copa Airlines', 'B738',  'Boeing 737-800',          160, '{B738}',                         false),
  ('Copa Airlines', 'B38M',  'Boeing 737 MAX 8',        166, '{B38M}',                         false),
  ('Copa Airlines', 'B39M',  'Boeing 737 MAX 9',        166, '{B39M}',                         false);

-- ---------------------------------------------------------------------------
-- 2. Flota: matrícula → modelo
-- ---------------------------------------------------------------------------
create table public.aircraft (
  registration  text primary key,               -- normalizada: HP-1997
  aircraft_code text not null references public.aircraft_types (aircraft_code) on update cascade,
  airline       text not null default 'Air Panama',
  verified      boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now()
);

insert into public.aircraft (registration, aircraft_code, verified, notes) values
  ('HP-1997', 'DH8D',  true,  null),
  ('HP-1891', 'F-50',  true,  null),
  ('HP-1993', 'C-208', true,  null),
  ('HP-1502', 'C-208', true,  null),
  ('HP-1797', 'DH8C',  false, 'Datos viejos la registran como DH8C; confirmar modelo'),
  ('HP-1952', 'DHC6',  false, 'Datos viejos la registran como DHC6; confirmar modelo'),
  ('HP-1793', 'F-50',  false, 'Datos viejos la registran como F50; confirmar'),
  ('HP-1812', 'C-208', false, 'Datos viejos la registran como C208; confirmar');

-- ---------------------------------------------------------------------------
-- 3. Tripulación
-- ---------------------------------------------------------------------------
create table public.crew_members (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null unique,
  role       text not null check (role in ('capitan', 'primer_oficial', 'cabina')),
  aliases    text[] not null default '{}',   -- variantes de escritura / errores de OCR
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.crew_members (full_name, role) values
  ('RUDY NIETO', 'capitan'),
  ('MARIO RODRIGUEZ', 'capitan'),
  ('ALEX CASTRO', 'capitan'),
  ('RICARDO ALVEO', 'capitan'),
  ('DIMAS PALACIOS', 'capitan'),
  ('JORGE CANO', 'capitan'),
  ('GUSTAVO CUNNINGHAM', 'capitan'),
  ('ROBERTO VEGA', 'capitan'),
  ('JUAN AIZPURUA', 'capitan'),
  ('ADAM ALMENGOR', 'primer_oficial'),
  ('EDUARDO HERRERA', 'primer_oficial'),
  ('LUCINIO PITTI', 'primer_oficial'),
  ('JOHAN HERRERA', 'primer_oficial'),
  ('PEDRO RODRIGUEZ', 'primer_oficial'),
  ('JEAN VALENCIA', 'primer_oficial'),
  ('LUIS BERMUDEZ', 'primer_oficial'),
  ('JERRY WAITE', 'primer_oficial'),
  ('JOSE CHANG', 'primer_oficial'),
  ('TAIRENA SIERRA', 'primer_oficial'),
  ('YESSICA QUINTERO', 'cabina'),
  ('KRYSTEL CEDEÑO', 'cabina'),
  ('IRIS PEREIRA', 'cabina'),
  ('NORMA ACOSTA', 'cabina'),
  ('BIANCA HIDALGO', 'cabina'),
  ('ALIX BARRERA', 'cabina'),
  ('JAVIER SANCHEZ', 'cabina'),
  ('YASLIN SANTAMARIA', 'cabina'),
  ('NATHALY VILLAREAL', 'cabina'),
  ('MILAGROS PEREZ', 'cabina');

-- ---------------------------------------------------------------------------
-- 4. Rutas (tabla existente, estaba vacía): minutos estimados de vuelo
-- ---------------------------------------------------------------------------
alter table public.flight_routes
  add column if not exists verified boolean not null default false;

alter table public.flight_routes
  add constraint flight_routes_route_key unique (airline, origin, destination);

insert into public.flight_routes (airline, origin, destination, estimated_duration_minutes) values
  ('Air Panama', 'PAC', 'DAV', 55), ('Air Panama', 'DAV', 'PAC', 55),
  ('Air Panama', 'PAC', 'BOC', 55), ('Air Panama', 'BOC', 'PAC', 55),
  ('Air Panama', 'PAC', 'CHX', 60), ('Air Panama', 'CHX', 'PAC', 60),
  ('Air Panama', 'BOC', 'DAV', 40), ('Air Panama', 'DAV', 'BOC', 40),
  ('Air Panama', 'CHX', 'BOC', 20), ('Air Panama', 'BOC', 'CHX', 20),
  ('Air Panama', 'PAC', 'CTD', 35), ('Air Panama', 'CTD', 'PAC', 35);

-- ---------------------------------------------------------------------------
-- 5. Vuelos regulares: un número puede tener VARIOS tramos (693 CHX-BOC y BOC-DAV)
-- ---------------------------------------------------------------------------
create table public.scheduled_flights (
  id              uuid primary key default gen_random_uuid(),
  airline         text not null default 'Air Panama',
  flight_number   text not null,
  origin          text not null,
  destination     text not null,
  usual_departure text,                 -- HH:MM; null si varía
  aircraft_code   text references public.aircraft_types (aircraft_code) on update cascade,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (airline, flight_number, origin, destination)
);

insert into public.scheduled_flights (flight_number, origin, destination, usual_departure, aircraft_code) values
  ('670', 'PAC', 'DAV', '07:00', 'DH8D'),
  ('671', 'DAV', 'PAC', '08:30', 'DH8D'),
  ('680', 'PAC', 'DAV', null,    'DH8D'),
  ('681', 'DAV', 'PAC', null,    'DH8D'),
  ('970', 'PAC', 'DAV', '16:15', 'DH8D'),
  ('971', 'DAV', 'PAC', '17:30', 'DH8D'),
  ('650', 'PAC', 'CTD', '08:00', 'F-50'),
  ('651', 'CTD', 'PAC', '08:45', 'F-50'),
  ('682', 'PAC', 'BOC', '09:45', 'F-50'),
  ('683', 'BOC', 'PAC', '11:15', 'F-50'),
  ('980', 'PAC', 'BOC', '12:45', 'F-50'),
  ('981', 'BOC', 'PAC', '14:15', 'F-50'),
  ('982', 'PAC', 'BOC', '16:00', 'F-50'),
  ('983', 'BOC', 'PAC', '17:30', 'F-50'),
  ('684', 'PAC', 'CHX', null,    'C-208'),  -- 9:00 o 11:00 según el día
  ('685', 'CHX', 'PAC', '12:30', 'C-208'),
  ('693', 'CHX', 'BOC', '10:30', 'C-208'),
  ('693', 'BOC', 'DAV', '10:50', 'C-208'),
  ('692', 'DAV', 'BOC', '11:55', 'C-208'),
  ('692', 'BOC', 'CHX', '12:40', 'C-208'),
  ('985', 'CHX', 'PAC', '13:00', 'C-208');

-- ---------------------------------------------------------------------------
-- 6. Vuelos: tripulación de cabina y notas separadas de los pilotos
-- ---------------------------------------------------------------------------
alter table public.manual_flights_log
  add column if not exists cabin_crew text,
  add column if not exists notes text;

-- ---------------------------------------------------------------------------
-- 7. Seguridad: lectura para usuarios aprobados, escritura solo administradores
--    (antes aircraft_types y flight_routes eran de lectura pública, incluso sin sesión)
-- ---------------------------------------------------------------------------
drop policy if exists "Permitir lectura pública a aircraft_types" on public.aircraft_types;
drop policy if exists "Permitir lectura pública a flight_routes" on public.flight_routes;

alter table public.aircraft enable row level security;
alter table public.crew_members enable row level security;
alter table public.scheduled_flights enable row level security;

do $$
declare t text;
begin
  foreach t in array array['aircraft_types', 'aircraft', 'crew_members', 'flight_routes', 'scheduled_flights'] loop
    execute format('create policy "Aprobados leen %1$s" on public.%1$I for select to authenticated using (private.is_approved())', t);
    execute format('create policy "Admins gestionan %1$s" on public.%1$I for all to authenticated using (private.is_admin()) with check (private.is_admin())', t);
  end loop;
end $$;
