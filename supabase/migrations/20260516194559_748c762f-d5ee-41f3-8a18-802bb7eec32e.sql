
-- =========================================
-- ENUM de roles
-- =========================================
CREATE TYPE public.app_role AS ENUM ('supervisor', 'calidad', 'operario', 'panol', 'admin_usuarios');

-- =========================================
-- Tabla profiles
-- =========================================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  email TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- Tabla user_roles
-- =========================================
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- has_role (security definer, evita recursión RLS)
-- =========================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =========================================
-- Tabla ordenes
-- =========================================
CREATE TABLE public.ordenes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nro_orden INTEGER NOT NULL,
  fecha_creacion DATE,
  fecha_inicio DATE,
  fecha_finalizacion DATE,
  fecha_limite_realizacion DATE,
  tecnico_responsable TEXT DEFAULT '',
  sector TEXT DEFAULT '',
  tipo_orden TEXT DEFAULT '',
  aprobado BOOLEAN NOT NULL DEFAULT false,
  estado TEXT DEFAULT 'Pendiente',
  prioridad TEXT DEFAULT 'Media',
  horas_presupuestadas NUMERIC,
  horas_reales NUMERIC,
  descripcion_problema TEXT DEFAULT '',
  codigo_documento TEXT DEFAULT '',
  codigo_equipo TEXT DEFAULT '',
  nombre_equipo TEXT DEFAULT '',
  solicitante TEXT DEFAULT '',
  trabajo_solicitado TEXT DEFAULT '',
  estado_recepcion_equipo TEXT DEFAULT '',
  observaciones TEXT DEFAULT '',
  sector_limpio_ordenado BOOLEAN NOT NULL DEFAULT false,
  herramientas_limpias_ordenadas BOOLEAN NOT NULL DEFAULT false,
  control_liberacion_calidad BOOLEAN NOT NULL DEFAULT false,
  responsable_control_calidad TEXT DEFAULT '',
  elaboro TEXT DEFAULT '',
  reviso TEXT DEFAULT '',
  aprobo TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ordenes ENABLE ROW LEVEL SECURITY;

-- =========================================
-- Tabla materiales
-- =========================================
CREATE TABLE public.materiales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_id UUID NOT NULL REFERENCES public.ordenes(id) ON DELETE CASCADE,
  cantidad NUMERIC,
  descripcion TEXT DEFAULT '',
  codigo TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.materiales ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_materiales_orden ON public.materiales(orden_id);

-- =========================================
-- updated_at automático
-- =========================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- Trigger ordenes: setear created_by/updated_by + validar permisos por inciso
-- =========================================
CREATE OR REPLACE FUNCTION public.ordenes_audit_and_authz()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  is_sup BOOLEAN;
  is_cal BOOLEAN;
  is_ope BOOLEAN;
  is_pan BOOLEAN;
  changed_1 BOOLEAN;
  changed_2 BOOLEAN;
  changed_3 BOOLEAN;
  changed_4 BOOLEAN;
  changed_6 BOOLEAN;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  is_sup := public.has_role(uid, 'supervisor');
  is_cal := public.has_role(uid, 'calidad');
  is_ope := public.has_role(uid, 'operario');
  is_pan := public.has_role(uid, 'panol');

  IF TG_OP = 'INSERT' THEN
    IF NOT is_sup THEN
      RAISE EXCEPTION 'Solo Supervisor puede crear órdenes';
    END IF;
    NEW.created_by := uid;
    NEW.updated_by := uid;
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_by := uid;
    NEW.updated_at := now();
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;

    IF is_sup THEN
      RETURN NEW;
    END IF;

    -- Detectar qué inciso cambió
    changed_1 := (NEW.nro_orden IS DISTINCT FROM OLD.nro_orden)
              OR (NEW.fecha_creacion IS DISTINCT FROM OLD.fecha_creacion)
              OR (NEW.solicitante IS DISTINCT FROM OLD.solicitante)
              OR (NEW.tecnico_responsable IS DISTINCT FROM OLD.tecnico_responsable)
              OR (NEW.sector IS DISTINCT FROM OLD.sector)
              OR (NEW.tipo_orden IS DISTINCT FROM OLD.tipo_orden)
              OR (NEW.estado IS DISTINCT FROM OLD.estado)
              OR (NEW.prioridad IS DISTINCT FROM OLD.prioridad)
              OR (NEW.aprobado IS DISTINCT FROM OLD.aprobado);

    changed_2 := (NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio)
              OR (NEW.fecha_finalizacion IS DISTINCT FROM OLD.fecha_finalizacion)
              OR (NEW.fecha_limite_realizacion IS DISTINCT FROM OLD.fecha_limite_realizacion)
              OR (NEW.horas_presupuestadas IS DISTINCT FROM OLD.horas_presupuestadas)
              OR (NEW.horas_reales IS DISTINCT FROM OLD.horas_reales)
              OR (NEW.descripcion_problema IS DISTINCT FROM OLD.descripcion_problema)
              OR (NEW.trabajo_solicitado IS DISTINCT FROM OLD.trabajo_solicitado);

    changed_3 := (NEW.codigo_documento IS DISTINCT FROM OLD.codigo_documento)
              OR (NEW.codigo_equipo IS DISTINCT FROM OLD.codigo_equipo)
              OR (NEW.nombre_equipo IS DISTINCT FROM OLD.nombre_equipo);

    changed_4 := (NEW.estado_recepcion_equipo IS DISTINCT FROM OLD.estado_recepcion_equipo)
              OR (NEW.sector_limpio_ordenado IS DISTINCT FROM OLD.sector_limpio_ordenado)
              OR (NEW.herramientas_limpias_ordenadas IS DISTINCT FROM OLD.herramientas_limpias_ordenadas)
              OR (NEW.observaciones IS DISTINCT FROM OLD.observaciones);

    changed_6 := (NEW.control_liberacion_calidad IS DISTINCT FROM OLD.control_liberacion_calidad)
              OR (NEW.responsable_control_calidad IS DISTINCT FROM OLD.responsable_control_calidad)
              OR (NEW.elaboro IS DISTINCT FROM OLD.elaboro)
              OR (NEW.reviso IS DISTINCT FROM OLD.reviso)
              OR (NEW.aprobo IS DISTINCT FROM OLD.aprobo);

    -- Reglas por rol
    IF is_cal THEN
      IF changed_1 OR changed_2 OR changed_3 OR changed_4 THEN
        RAISE EXCEPTION 'El rol Calidad solo puede editar el inciso 6';
      END IF;
      RETURN NEW;
    END IF;

    IF is_ope THEN
      IF changed_1 OR changed_2 OR changed_6 THEN
        RAISE EXCEPTION 'El rol Operario solo puede editar los incisos 3 y 4';
      END IF;
      RETURN NEW;
    END IF;

    IF is_pan THEN
      IF changed_1 OR changed_2 OR changed_3 OR changed_4 OR changed_6 THEN
        RAISE EXCEPTION 'El rol Pañol solo puede editar el inciso 5 (materiales)';
      END IF;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Sin permisos para editar órdenes';
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF NOT is_sup THEN
      RAISE EXCEPTION 'Solo Supervisor puede eliminar órdenes';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_ordenes_authz
BEFORE INSERT OR UPDATE OR DELETE ON public.ordenes
FOR EACH ROW EXECUTE FUNCTION public.ordenes_audit_and_authz();

-- =========================================
-- handle_new_user: crea profile al registrar
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nombre, email, activo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- RLS Policies
-- =========================================

-- profiles
CREATE POLICY "Autenticados ven perfiles"
ON public.profiles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin usuarios inserta perfiles"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin_usuarios'));

CREATE POLICY "Admin usuarios actualiza perfiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin_usuarios'));

CREATE POLICY "Admin usuarios elimina perfiles"
ON public.profiles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin_usuarios'));

-- user_roles
CREATE POLICY "Autenticados ven roles"
ON public.user_roles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin usuarios inserta roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin_usuarios'));

CREATE POLICY "Admin usuarios elimina roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin_usuarios'));

CREATE POLICY "Admin usuarios actualiza roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin_usuarios'));

-- ordenes
CREATE POLICY "Autenticados ven ordenes"
ON public.ordenes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Autenticados con rol crean ordenes"
ON public.ordenes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Autenticados con rol actualizan ordenes"
ON public.ordenes FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'calidad')
  OR public.has_role(auth.uid(), 'operario')
  OR public.has_role(auth.uid(), 'panol')
);

CREATE POLICY "Supervisor elimina ordenes"
ON public.ordenes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'supervisor'));

-- materiales
CREATE POLICY "Autenticados ven materiales"
ON public.materiales FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Supervisor o Pañol inserta materiales"
ON public.materiales FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'panol')
);

CREATE POLICY "Supervisor o Pañol actualiza materiales"
ON public.materiales FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'panol')
);

CREATE POLICY "Supervisor o Pañol elimina materiales"
ON public.materiales FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'panol')
);

-- =========================================
-- Crear usuario inicial: fcatanzaro@incalfer.com
-- =========================================
DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Si ya existe, no hacer nada
  SELECT id INTO new_user_id FROM auth.users WHERE email = 'fcatanzaro@incalfer.com';

  IF new_user_id IS NULL THEN
    new_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'fcatanzaro@incalfer.com',
      crypt('Clave:incalfer2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"Francisco Catanzaro"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', 'fcatanzaro@incalfer.com', 'email_verified', true),
      'email',
      now(), now(), now()
    );
  END IF;

  -- Asegurar profile
  INSERT INTO public.profiles (user_id, nombre, email, activo)
  VALUES (new_user_id, 'Francisco Catanzaro', 'fcatanzaro@incalfer.com', true)
  ON CONFLICT (user_id) DO UPDATE SET nombre = EXCLUDED.nombre, email = EXCLUDED.email;

  -- Asignar roles
  INSERT INTO public.user_roles (user_id, role) VALUES (new_user_id, 'supervisor') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (new_user_id, 'admin_usuarios') ON CONFLICT DO NOTHING;
END $$;
