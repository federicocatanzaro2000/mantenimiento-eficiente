ALTER TABLE public.preventivos_planes
  ADD COLUMN IF NOT EXISTS dia_preferido integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS mes_inicio integer NOT NULL DEFAULT 1;

ALTER TABLE public.preventivos_planes
  ADD CONSTRAINT preventivos_planes_dia_preferido_chk CHECK (dia_preferido BETWEEN 1 AND 31),
  ADD CONSTRAINT preventivos_planes_mes_inicio_chk CHECK (mes_inicio BETWEEN 1 AND 12);