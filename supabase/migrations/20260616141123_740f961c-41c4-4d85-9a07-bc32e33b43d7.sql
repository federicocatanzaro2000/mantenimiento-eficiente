ALTER TABLE public.ordenes ADD COLUMN IF NOT EXISTS comentario_calidad text;

CREATE OR REPLACE FUNCTION public.ordenes_audit_and_authz()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  changed_5 BOOLEAN;
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

    changed_5 := (NEW.materiales_utilizados IS DISTINCT FROM OLD.materiales_utilizados);

    changed_6 := (NEW.control_liberacion_calidad IS DISTINCT FROM OLD.control_liberacion_calidad)
              OR (NEW.responsable_control_calidad IS DISTINCT FROM OLD.responsable_control_calidad)
              OR (NEW.elaboro IS DISTINCT FROM OLD.elaboro)
              OR (NEW.reviso IS DISTINCT FROM OLD.reviso)
              OR (NEW.aprobo IS DISTINCT FROM OLD.aprobo)
              OR (NEW.comentario_calidad IS DISTINCT FROM OLD.comentario_calidad);

    IF is_cal THEN
      IF changed_1 OR changed_2 OR changed_3 OR changed_4 OR changed_5 THEN
        RAISE EXCEPTION 'El rol Calidad solo puede editar el inciso 6';
      END IF;
      RETURN NEW;
    END IF;

    IF is_ope THEN
      IF changed_1 OR changed_2 OR changed_5 OR changed_6 THEN
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
END; $function$;