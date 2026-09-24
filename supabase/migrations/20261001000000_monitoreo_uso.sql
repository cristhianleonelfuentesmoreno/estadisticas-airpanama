-- Monitoreo del plan gratuito de Supabase (solo el administrador lo ve en el panel):
-- tamaño de la base, peso y filas de cada tabla, archivos guardados, usuarios y última actividad.
create or replace function public.monitoreo_uso()
returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  t record;
  filas bigint;
  tablas jsonb := '[]'::jsonb;
begin
  for t in
    select c.oid, c.relname
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('select count(*) from public.%I', t.relname) into filas;
    tablas := tablas || jsonb_build_object(
      'tabla', t.relname,
      'filas', filas,
      'bytes', pg_catalog.pg_total_relation_size(t.oid),
      'datos_bytes', pg_catalog.pg_relation_size(t.oid),
      'indices_bytes', pg_catalog.pg_indexes_size(t.oid)
    );
  end loop;

  return jsonb_build_object(
    'db_bytes', pg_catalog.pg_database_size(pg_catalog.current_database()),
    'tablas', tablas,
    'storage_bytes', (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o),
    'storage_archivos', (select count(*) from storage.objects),
    'usuarios_total', (select count(*) from auth.users),
    'usuarios_mes', (select count(*) from auth.users u where u.last_sign_in_at >= date_trunc('month', now())),
    'ultima_actividad', greatest(
      (select max(s.ultima_actividad) from public.sesiones s),
      (select max(r.creado_en) from public.registros_auditoria r),
      (select max(u.last_sign_in_at) from auth.users u)
    ),
    'medido_en', now()
  );
end;
$$;
revoke all on function public.monitoreo_uso() from public, anon, authenticated;
