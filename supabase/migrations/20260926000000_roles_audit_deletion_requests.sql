-- Tres niveles de acceso, bitácora completa e inalterable, y eliminación con solicitud.
--   usuario     → trabajo diario: registra, edita, aprueba vuelos y solicita eliminaciones
--   supervisor  → además acepta usuarios, resuelve solicitudes y ve la bitácora
--   administrador → además roles, cuentas, configuración y flota

-- 1. Rol supervisor --------------------------------------------------------------
alter table public.perfiles drop constraint perfiles_role_check;
alter table public.perfiles add constraint perfiles_role_check
  check (role = any (array['administrador', 'supervisor', 'usuario']));

create or replace function private.is_supervisor()
returns boolean
language sql stable security definer set search_path to ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and role in ('supervisor', 'administrador') and status = 'aprobado'
  );
$$;

create policy "Supervisores leen todos los perfiles" on public.perfiles
  for select to authenticated using (private.is_supervisor());

-- 2. Bitácora --------------------------------------------------------------------
alter type public.tipo_evento_auditoria add value if not exists 'creacion';
alter type public.tipo_evento_auditoria add value if not exists 'aprobacion';
alter type public.tipo_evento_auditoria add value if not exists 'solicitud_eliminacion';
alter type public.tipo_evento_auditoria add value if not exists 'resolucion_solicitud';
alter type public.tipo_evento_auditoria add value if not exists 'restauracion';
alter type public.tipo_evento_auditoria add value if not exists 'importacion';
alter type public.tipo_evento_auditoria add value if not exists 'exportacion';
alter type public.tipo_evento_auditoria add value if not exists 'navegacion';

alter table public.registros_auditoria
  add column if not exists actor_nombre text,   -- quién lo hizo (copia: sigue legible aunque se borre la cuenta)
  add column if not exists actor_rol text,
  add column if not exists entidad text,        -- 'vuelo', 'usuario', 'flota', 'configuracion'…
  add column if not exists entidad_id text;

create index if not exists registros_auditoria_creado_idx on public.registros_auditoria (creado_en desc);
create index if not exists registros_auditoria_usuario_idx on public.registros_auditoria (usuario_id, creado_en desc);
create index if not exists registros_auditoria_tipo_idx on public.registros_auditoria (tipo_evento, creado_en desc);

drop policy if exists "Admins pueden ver auditoria" on public.registros_auditoria;
create policy "Supervisores ven la bitacora" on public.registros_auditoria
  for select to authenticated using (private.is_supervisor());

-- Inalterable: nadie la edita ni la borra, ni siquiera con la llave de servicio.
-- Única excepción: al borrar una cuenta, usuario_id pasa a null (actor_nombre conserva quién fue).
create or replace function private.bitacora_inalterable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.usuario_id is not null and new.usuario_id is null
     and (to_jsonb(new) - 'usuario_id') = (to_jsonb(old) - 'usuario_id') then
    return new;
  end if;
  raise exception 'La bitácora de auditoría no se puede modificar ni borrar';
end;
$$;

drop trigger if exists bitacora_inalterable on public.registros_auditoria;
create trigger bitacora_inalterable
  before update or delete on public.registros_auditoria
  for each row execute function private.bitacora_inalterable();

-- 3. Eliminación que solo oculta (se puede restaurar) ------------------------------
alter table public.llegadas_malek_historico
  add column if not exists eliminado_en timestamptz,
  add column if not exists eliminado_por uuid references public.perfiles (id) on delete set null,
  add column if not exists motivo_eliminacion text;
alter table public.salidas_malek_historico
  add column if not exists eliminado_en timestamptz,
  add column if not exists eliminado_por uuid references public.perfiles (id) on delete set null,
  add column if not exists motivo_eliminacion text;

-- 4. Solicitudes de eliminación -----------------------------------------------------
create table if not exists public.solicitudes_eliminacion (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('llegada', 'salida')),
  vuelo_id        uuid not null,
  resumen         jsonb not null default '{}',   -- fecha, vuelo, ruta, pasajeros al momento de pedirla
  motivo          text not null check (length(trim(motivo)) > 0),
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  solicitado_por  uuid references public.perfiles (id) on delete set null,
  solicitado_nombre text,
  solicitado_en   timestamptz not null default now(),
  resuelto_por    uuid references public.perfiles (id) on delete set null,
  resuelto_nombre text,
  resuelto_en     timestamptz,
  comentario      text
);

-- Una sola solicitud pendiente por vuelo
create unique index if not exists solicitudes_eliminacion_una_pendiente
  on public.solicitudes_eliminacion (tipo, vuelo_id) where estado = 'pendiente';
create index if not exists solicitudes_eliminacion_estado_idx
  on public.solicitudes_eliminacion (estado, solicitado_en desc);

alter table public.solicitudes_eliminacion enable row level security;
-- Se escriben solo desde el servidor (acciones con permisos verificados)
create policy "Supervisores ven las solicitudes" on public.solicitudes_eliminacion
  for select to authenticated using (private.is_supervisor());
create policy "Usuarios ven sus solicitudes" on public.solicitudes_eliminacion
  for select to authenticated using (solicitado_por = auth.uid());
