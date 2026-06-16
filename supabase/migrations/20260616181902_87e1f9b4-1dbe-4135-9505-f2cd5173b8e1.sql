
-- 1) Tighten profiles SELECT policy: own profile or admin_usuarios
DROP POLICY IF EXISTS "Autenticados ven perfiles" ON public.profiles;
CREATE POLICY "Ver perfil propio o admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin_usuarios'));

-- 2) RPC to fetch basic profile info (user_id, nombre) for display purposes
CREATE OR REPLACE FUNCTION public.get_profiles_basic()
RETURNS TABLE (user_id uuid, nombre text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, nombre FROM public.profiles;
$$;
REVOKE ALL ON FUNCTION public.get_profiles_basic() FROM public;
GRANT EXECUTE ON FUNCTION public.get_profiles_basic() TO authenticated;

-- 3) Storage UPDATE policy for work-order-attachments
CREATE POLICY "WO attachments update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'work-order-attachments'
  AND (public.has_role(auth.uid(), 'supervisor') OR owner = auth.uid())
)
WITH CHECK (
  bucket_id = 'work-order-attachments'
  AND (public.has_role(auth.uid(), 'supervisor') OR owner = auth.uid())
);
