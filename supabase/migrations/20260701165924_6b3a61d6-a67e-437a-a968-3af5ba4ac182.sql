
CREATE TABLE public.document_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX document_codes_code_unique ON public.document_codes (lower(btrim(code)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_codes TO authenticated;
GRANT ALL ON public.document_codes TO service_role;

ALTER TABLE public.document_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_codes read auth" ON public.document_codes FOR SELECT USING (true);
CREATE POLICY "document_codes insert sup" ON public.document_codes FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "document_codes update sup" ON public.document_codes FOR UPDATE USING (public.has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "document_codes delete sup" ON public.document_codes FOR DELETE USING (public.has_role(auth.uid(), 'supervisor'::app_role));

CREATE TRIGGER document_codes_touch_updated_at BEFORE UPDATE ON public.document_codes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
