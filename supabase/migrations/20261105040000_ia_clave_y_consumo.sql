-- Inteligencia artificial administrada desde el panel:
-- una sola clave de Claude (cifrada en la bóveda de Supabase), límite por tienda y consumo de cada lectura.

-- ---------- Configuración (una sola fila) ----------

create table public.config_ia (
  id int primary key default 1 check (id = 1),
  modelo text not null default 'claude-haiku-5-5',
  limite_diario int not null default 20 check (limite_diario between 0 and 500),
  clave_final text,
  clave_actualizada_en timestamptz,
  clave_actualizada_por uuid references auth.users(id) on delete set null
);
insert into public.config_ia (id) values (1);
alter table public.config_ia enable row level security;
revoke all on public.config_ia from anon, authenticated;
-- Sin políticas: solo el servidor (service role) y las funciones de abajo la leen o cambian.

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = (select auth.uid()) and role = 'administrador' and status = 'aprobado');
$$;
revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- Guarda o reemplaza la clave. Solo el administrador. La clave nunca vuelve a salir por la API.
create or replace function public.guardar_clave_ia(p_clave text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare
  v_id uuid;
begin
  if not public.es_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_clave is null or length(trim(p_clave)) < 20 then
    raise exception 'Clave inválida';
  end if;
  select id into v_id from vault.secrets where name = 'valisventas_anthropic_api_key';
  if v_id is null then
    perform vault.create_secret(trim(p_clave), 'valisventas_anthropic_api_key', 'Clave de Claude para leer facturas');
  else
    perform vault.update_secret(v_id, trim(p_clave));
  end if;
  update config_ia set clave_final = right(trim(p_clave), 4), clave_actualizada_en = now(), clave_actualizada_por = auth.uid() where id = 1;
end;
$$;
revoke all on function public.guardar_clave_ia(text) from public, anon;
grant execute on function public.guardar_clave_ia(text) to authenticated;

create or replace function public.quitar_clave_ia()
returns void language plpgsql security definer set search_path = public, vault as $$
begin
  if not public.es_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  -- Se vacía en vez de borrarse: clave_ia() trata una clave vacía como si no hubiera
  perform vault.update_secret(id, '') from vault.secrets where name = 'valisventas_anthropic_api_key';
  update config_ia set clave_final = null, clave_actualizada_en = now(), clave_actualizada_por = auth.uid() where id = 1;
end;
$$;
revoke all on function public.quitar_clave_ia() from public, anon;
grant execute on function public.quitar_clave_ia() to authenticated;

create or replace function public.guardar_config_ia(p_limite int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update config_ia set limite_diario = p_limite where id = 1;
end;
$$;
revoke all on function public.guardar_config_ia(int) from public, anon;
grant execute on function public.guardar_config_ia(int) to authenticated;

-- Solo el servidor puede leer la clave descifrada
create or replace function public.clave_ia()
returns text language sql stable security definer set search_path = public, vault as $$
  select nullif(decrypted_secret, '') from vault.decrypted_secrets where name = 'valisventas_anthropic_api_key' limit 1;
$$;
revoke all on function public.clave_ia() from public, anon, authenticated;
grant execute on function public.clave_ia() to service_role;

-- ---------- Consumo de cada lectura ----------

alter table public.usos_ia
  add column modelo text,
  add column tokens_entrada int,
  add column tokens_salida int,
  add column costo_usd numeric(12,6),
  add column ok boolean,
  add column error text check (error is null or length(error) <= 300),
  add column lineas int,
  add column duracion_ms int;

-- Reemplaza a usar_ia(uuid, int), que queda sin uso y sin permiso: el límite sale de config_ia
-- y devuelve el id del uso para anotar su consumo
revoke all on function public.usar_ia(uuid, int) from authenticated;
create or replace function public.reservar_ia(p_tienda uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_desde timestamptz := (now() at time zone 'America/Panama')::date::timestamp at time zone 'America/Panama';
  v_limite int;
  v_usados int;
  v_id bigint;
begin
  if auth.uid() is null or not public.es_miembro_tienda(p_tienda) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select limite_diario into v_limite from config_ia where id = 1;
  perform 1 from tiendas where id = p_tienda for update;
  select count(*) into v_usados from usos_ia where tienda_id = p_tienda and creado_en >= v_desde;
  if v_usados >= v_limite then
    return jsonb_build_object('quedan', -1, 'limite', v_limite);
  end if;
  insert into usos_ia (tienda_id, usuario_id, tipo) values (p_tienda, auth.uid(), 'factura') returning id into v_id;
  return jsonb_build_object('quedan', v_limite - v_usados - 1, 'limite', v_limite, 'uso_id', v_id);
end;
$$;
revoke all on function public.reservar_ia(uuid) from public, anon;
grant execute on function public.reservar_ia(uuid) to authenticated;
