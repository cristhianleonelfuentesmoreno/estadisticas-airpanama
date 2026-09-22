-- 1. Actualizar la función del trigger para que capture el nombre al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, email, role, status, nombre)
  VALUES (
    NEW.id,
    NEW.email,
    'usuario',
    'pendiente',
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

-- 2. Asegurarse de que el trigger esté asignado (por si acaso no lo estuviera)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Actualizar los usuarios existentes que no tienen nombre en 'perfiles'
UPDATE public.perfiles p
SET nombre = u.raw_user_meta_data->>'full_name'
FROM auth.users u
WHERE p.id = u.id
  AND (p.nombre IS NULL OR p.nombre = '')
  AND u.raw_user_meta_data->>'full_name' IS NOT NULL;
