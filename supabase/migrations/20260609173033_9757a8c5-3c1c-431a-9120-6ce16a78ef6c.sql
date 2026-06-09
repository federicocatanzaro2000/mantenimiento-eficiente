
CREATE TABLE public.preventive_manual_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_date date NOT NULL,
  scheduled_year int NOT NULL,
  scheduled_month int NOT NULL,
  scheduled_day int NOT NULL,
  equipment_id uuid REFERENCES public.equipment(id) ON DELETE SET NULL,
  equipment_code_snapshot text NOT NULL,
  equipment_name_snapshot text NOT NULL,
  task_name text NOT NULL,
  preventive_type text NOT NULL DEFAULT 'Otro',
  frequency_label text,
  status text NOT NULL DEFAULT 'Programado',
  responsible_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  estimated_hours numeric,
  notes text,
  work_order_id uuid REFERENCES public.ordenes(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.preventive_manual_items TO authenticated;
GRANT ALL ON public.preventive_manual_items TO service_role;

ALTER TABLE public.preventive_manual_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pmi read auth" ON public.preventive_manual_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pmi insert sup" ON public.preventive_manual_items
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "pmi update sup" ON public.preventive_manual_items
  FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'supervisor'))
    WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "pmi delete sup" ON public.preventive_manual_items
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));

CREATE INDEX pmi_scheduled_date_idx ON public.preventive_manual_items(scheduled_date);
CREATE INDEX pmi_year_idx ON public.preventive_manual_items(scheduled_year);
CREATE INDEX pmi_equipment_idx ON public.preventive_manual_items(equipment_id);
CREATE INDEX pmi_status_idx ON public.preventive_manual_items(status);
CREATE INDEX pmi_work_order_idx ON public.preventive_manual_items(work_order_id);

CREATE UNIQUE INDEX pmi_unique_active
  ON public.preventive_manual_items (lower(equipment_code_snapshot), lower(task_name), scheduled_date)
  WHERE active;

CREATE OR REPLACE FUNCTION public.pmi_fill_parts()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.scheduled_year := EXTRACT(YEAR FROM NEW.scheduled_date)::int;
  NEW.scheduled_month := EXTRACT(MONTH FROM NEW.scheduled_date)::int;
  NEW.scheduled_day := EXTRACT(DAY FROM NEW.scheduled_date)::int;
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END; $$;

CREATE TRIGGER pmi_fill_parts_trg
BEFORE INSERT OR UPDATE ON public.preventive_manual_items
FOR EACH ROW EXECUTE FUNCTION public.pmi_fill_parts();
