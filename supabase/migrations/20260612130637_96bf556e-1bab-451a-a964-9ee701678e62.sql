
CREATE TABLE public.order_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  description TEXT,
  requires_line_stoppage_question BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX order_types_name_unique_ci ON public.order_types (lower(btrim(name)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_types TO authenticated;
GRANT ALL ON public.order_types TO service_role;

ALTER TABLE public.order_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order types read" ON public.order_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Order types insert" ON public.order_types
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'supervisor'));

CREATE POLICY "Order types update" ON public.order_types
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'supervisor'));

CREATE POLICY "Order types delete" ON public.order_types
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'supervisor'));

CREATE TRIGGER trg_order_types_updated_at
  BEFORE UPDATE ON public.order_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.order_types (name, sort_order, requires_line_stoppage_question) VALUES
  ('Preventivo',      10, false),
  ('Correctivo',      20, true),
  ('Proyectos',       30, false),
  ('Cambio de equipo',40, false),
  ('Edilicio',        50, false),
  ('Limpieza',        60, false);
