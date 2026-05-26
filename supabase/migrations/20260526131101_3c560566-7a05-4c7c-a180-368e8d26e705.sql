
-- Preventive maintenance module

CREATE TABLE public.preventivos_planes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo TEXT NOT NULL,
  equipo_codigo TEXT,
  tarea TEXT NOT NULL,
  tipo_tarea TEXT,
  frecuencia_texto TEXT,
  frecuencia_valor NUMERIC,
  frecuencia_unidad TEXT,
  source_file TEXT,
  source_sheet TEXT,
  source_row INTEGER,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (equipo, equipo_codigo, tarea, frecuencia_texto, source_sheet)
);

CREATE TABLE public.preventivos_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.preventivos_planes(id) ON DELETE CASCADE,
  scheduled_date DATE,
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  dia INTEGER,
  estado TEXT NOT NULL DEFAULT 'Programado',
  orden_id UUID REFERENCES public.ordenes(id) ON DELETE SET NULL,
  fecha_real DATE,
  observaciones TEXT DEFAULT '',
  import_notes TEXT,
  source_cell TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, anio, mes, source_cell)
);

CREATE INDEX idx_schedule_fecha ON public.preventivos_schedule(scheduled_date);
CREATE INDEX idx_schedule_estado ON public.preventivos_schedule(estado);
CREATE INDEX idx_schedule_orden ON public.preventivos_schedule(orden_id);

CREATE TABLE public.preventivos_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_hash TEXT,
  imported_by UUID,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  anios_detectados INTEGER[],
  hojas_procesadas TEXT[],
  planes_creados INTEGER DEFAULT 0,
  planes_actualizados INTEGER DEFAULT 0,
  schedule_creados INTEGER DEFAULT 0,
  schedule_actualizados INTEGER DEFAULT 0,
  schedule_omitidos INTEGER DEFAULT 0,
  errores JSONB DEFAULT '[]'::jsonb,
  estado TEXT NOT NULL DEFAULT 'completado'
);

CREATE TABLE public.preventivos_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.preventivos_schedule(id) ON DELETE CASCADE,
  alert_date DATE NOT NULL,
  alert_type TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  sent_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, alert_type)
);

-- Link orden -> preventivo schedule
ALTER TABLE public.ordenes ADD COLUMN preventivo_schedule_id UUID REFERENCES public.preventivos_schedule(id) ON DELETE SET NULL;
CREATE INDEX idx_ordenes_preventivo ON public.ordenes(preventivo_schedule_id);

-- Touch triggers
CREATE TRIGGER touch_preventivos_planes BEFORE UPDATE ON public.preventivos_planes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_preventivos_schedule BEFORE UPDATE ON public.preventivos_schedule
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Trigger: when orden vinculada se completa, marcar schedule como Completado
CREATE OR REPLACE FUNCTION public.sync_preventivo_from_orden()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.preventivo_schedule_id IS NOT NULL THEN
    IF (TG_OP = 'INSERT') OR (NEW.estado IS DISTINCT FROM OLD.estado) OR (NEW.preventivo_schedule_id IS DISTINCT FROM OLD.preventivo_schedule_id) THEN
      IF NEW.estado IN ('Cumplido','Completado','Finalizada','Finalizado') THEN
        UPDATE public.preventivos_schedule
          SET estado = 'Completado',
              fecha_real = COALESCE(NEW.fecha_finalizacion, CURRENT_DATE),
              orden_id = NEW.id,
              updated_at = now()
          WHERE id = NEW.preventivo_schedule_id;
      ELSE
        UPDATE public.preventivos_schedule
          SET estado = CASE
                WHEN NEW.estado = 'En proceso' THEN 'En proceso'
                ELSE 'OT creada'
              END,
              orden_id = NEW.id,
              updated_at = now()
          WHERE id = NEW.preventivo_schedule_id
            AND estado NOT IN ('Completado','Cancelado');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sync_preventivo_orden
AFTER INSERT OR UPDATE OF estado, preventivo_schedule_id, fecha_finalizacion
ON public.ordenes
FOR EACH ROW EXECUTE FUNCTION public.sync_preventivo_from_orden();

-- Audit / authz trigger for planes & schedule
CREATE OR REPLACE FUNCTION public.preventivos_authz()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  is_sup BOOLEAN;
  is_ope BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  is_sup := public.has_role(uid, 'supervisor');
  is_ope := public.has_role(uid, 'operario');

  IF TG_OP = 'INSERT' THEN
    IF NOT is_sup THEN RAISE EXCEPTION 'Solo Supervisor puede crear preventivos'; END IF;
    NEW.created_by := uid; NEW.updated_by := uid;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_by := uid;
    IF is_sup THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME = 'preventivos_schedule' AND is_ope THEN
      -- operario solo cambia estado a En proceso u observaciones
      IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
         OR NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date
         OR NEW.anio IS DISTINCT FROM OLD.anio
         OR NEW.mes IS DISTINCT FROM OLD.mes THEN
        RAISE EXCEPTION 'Operario solo puede actualizar estado y observaciones';
      END IF;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Sin permisos para editar preventivos';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF NOT is_sup THEN RAISE EXCEPTION 'Solo Supervisor puede eliminar preventivos'; END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_authz_planes
BEFORE INSERT OR UPDATE OR DELETE ON public.preventivos_planes
FOR EACH ROW EXECUTE FUNCTION public.preventivos_authz();

CREATE TRIGGER trg_authz_schedule
BEFORE INSERT OR UPDATE OR DELETE ON public.preventivos_schedule
FOR EACH ROW EXECUTE FUNCTION public.preventivos_authz();

-- RLS
ALTER TABLE public.preventivos_planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preventivos_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preventivos_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preventivos_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth ve planes" ON public.preventivos_planes FOR SELECT TO authenticated USING (true);
CREATE POLICY "sup crea planes" ON public.preventivos_planes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "sup edita planes" ON public.preventivos_planes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "sup elimina planes" ON public.preventivos_planes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'supervisor'));

CREATE POLICY "auth ve schedule" ON public.preventivos_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "sup crea schedule" ON public.preventivos_schedule FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "sup/ope edita schedule" ON public.preventivos_schedule FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'operario'));
CREATE POLICY "sup elimina schedule" ON public.preventivos_schedule FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'supervisor'));

CREATE POLICY "auth ve imports" ON public.preventivos_imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "sup crea imports" ON public.preventivos_imports FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'supervisor'));

CREATE POLICY "auth ve alertas" ON public.preventivos_alertas FOR SELECT TO authenticated USING (true);
CREATE POLICY "sup crea alertas" ON public.preventivos_alertas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "sup edita alertas" ON public.preventivos_alertas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "sup elimina alertas" ON public.preventivos_alertas FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'supervisor'));
