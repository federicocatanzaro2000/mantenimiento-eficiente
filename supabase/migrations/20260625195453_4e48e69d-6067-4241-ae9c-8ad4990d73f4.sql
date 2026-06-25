
ALTER TABLE public.preventive_manual_items
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES public.preventive_manual_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_recurrence_parent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat_every integer,
  ADD COLUMN IF NOT EXISTS repeat_unit text,
  ADD COLUMN IF NOT EXISTS repeat_end_mode text,
  ADD COLUMN IF NOT EXISTS repeat_end_date date,
  ADD COLUMN IF NOT EXISTS repeat_count integer;

ALTER TABLE public.preventive_manual_items
  DROP CONSTRAINT IF EXISTS pmi_repeat_unit_chk;
ALTER TABLE public.preventive_manual_items
  ADD CONSTRAINT pmi_repeat_unit_chk CHECK (repeat_unit IS NULL OR repeat_unit IN ('day','week','month','year'));

ALTER TABLE public.preventive_manual_items
  DROP CONSTRAINT IF EXISTS pmi_repeat_end_mode_chk;
ALTER TABLE public.preventive_manual_items
  ADD CONSTRAINT pmi_repeat_end_mode_chk CHECK (repeat_end_mode IS NULL OR repeat_end_mode IN ('never','until','count'));

CREATE INDEX IF NOT EXISTS ix_pmi_recurrence_parent ON public.preventive_manual_items(recurrence_parent_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pmi_recurrence_dedup
  ON public.preventive_manual_items(recurrence_parent_id, scheduled_date, equipment_code_snapshot)
  WHERE recurrence_parent_id IS NOT NULL AND active = true;
