-- Límite de lecturas de facturas con IA por tienda y por día (hora de Panamá), para controlar el costo.
create table public.usos_ia (
  id bigint generated always as identity primary key,
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  usuario_id uuid references auth.users(id) on delete set null,
  tipo text not null check (tipo in ('factura')),
  creado_en timestamptz not null default now()
);
create index usos_ia_tienda_idx on public.usos_ia(tienda_id, creado_en desc);

alter table public.usos_ia enable row level security;
revoke all on public.usos_ia from anon;
create policy usos_ia_select on public.usos_ia for select to authenticated
  using (public.es_miembro_tienda(tienda_id));

-- Cuenta un uso si todavía queda cupo hoy; devuelve cuántos quedan (-1 si ya no hay)
create or replace function public.usar_ia(p_tienda uuid, p_limite int)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_desde timestamptz := (now() at time zone 'America/Panama')::date::timestamp at time zone 'America/Panama';
  v_usados int;
begin
  if auth.uid() is null or not public.es_miembro_tienda(p_tienda) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform 1 from tiendas where id = p_tienda for update;
  select count(*) into v_usados from usos_ia where tienda_id = p_tienda and creado_en >= v_desde;
  if v_usados >= p_limite then
    return -1;
  end if;
  insert into usos_ia (tienda_id, usuario_id, tipo) values (p_tienda, auth.uid(), 'factura');
  return p_limite - v_usados - 1;
end;
$$;

revoke all on function public.usar_ia(uuid, int) from public, anon;
grant execute on function public.usar_ia(uuid, int) to authenticated;
