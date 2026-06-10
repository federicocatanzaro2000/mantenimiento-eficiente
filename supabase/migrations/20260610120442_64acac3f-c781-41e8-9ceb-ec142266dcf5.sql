ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS line_stopped boolean NULL,
  ADD COLUMN IF NOT EXISTS line_stopped_hours numeric NULL;

ALTER TABLE public.ordenes
  DROP CONSTRAINT IF EXISTS ordenes_line_stopped_hours_nonneg;
ALTER TABLE public.ordenes
  ADD CONSTRAINT ordenes_line_stopped_hours_nonneg
  CHECK (line_stopped_hours IS NULL OR line_stopped_hours >= 0);