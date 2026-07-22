
-- Sincroniza automáticamente el preventivo (preventive_manual_items) con el estado de su OIT
CREATE OR REPLACE FUNCTION public.sync_preventive_manual_from_orden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cumplidos CONSTANT text[] := ARRAY['Cumplido','Completado','Finalizada','Finalizado'];
  fecha_real date;
BEGIN
  -- Sólo actúa en INSERT/UPDATE de órdenes
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- Caso 1: OIT pasa a estado cumplido
  IF NEW.estado = ANY(cumplidos)
     AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado) THEN
    fecha_real := COALESCE(NEW.fecha_finalizacion, CURRENT_DATE);
    UPDATE public.preventive_manual_items
       SET status = 'Realizado',
           updated_at = now()
     WHERE work_order_id = NEW.id
       AND status <> 'Realizado';
  END IF;

  -- Caso 2: OIT reabierta (deja de estar cumplida) → volver el preventivo a 'Con OIT'
  IF TG_OP = 'UPDATE'
     AND OLD.estado = ANY(cumplidos)
     AND NOT (NEW.estado = ANY(cumplidos)) THEN
    UPDATE public.preventive_manual_items
       SET status = 'Con OIT',
           updated_at = now()
     WHERE work_order_id = NEW.id
       AND status = 'Realizado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_preventive_manual_from_orden ON public.ordenes;
CREATE TRIGGER trg_sync_preventive_manual_from_orden
AFTER INSERT OR UPDATE OF estado, fecha_finalizacion ON public.ordenes
FOR EACH ROW
EXECUTE FUNCTION public.sync_preventive_manual_from_orden();

-- Backfill: preventivos con OIT ya cumplida
UPDATE public.preventive_manual_items p
   SET status = 'Realizado', updated_at = now()
  FROM public.ordenes o
 WHERE p.work_order_id = o.id
   AND o.estado IN ('Cumplido','Completado','Finalizada','Finalizado')
   AND p.status <> 'Realizado';
