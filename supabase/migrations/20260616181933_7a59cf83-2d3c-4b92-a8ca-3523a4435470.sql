
-- Drop the helper function (not needed if email column is removed)
DROP FUNCTION IF EXISTS public.get_profiles_basic();

-- Restore broader read access for profiles (only non-sensitive columns remain)
DROP POLICY IF EXISTS "Ver perfil propio o admin" ON public.profiles;
CREATE POLICY "Autenticados ven perfiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Remove sensitive email column from profiles; email lives in auth.users
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- Update handle_new_user to no longer write email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, nombre, activo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $function$;
