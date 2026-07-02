
ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS materiales_previstos jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.preventive_manual_items
  ADD COLUMN IF NOT EXISTS materiales_previstos jsonb NOT NULL DEFAULT '[]'::jsonb;
