
-- ===== Cat\u00e1logo involucrados =====
CREATE TABLE public.catalogo_involucrados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('equipo','linea','sector')),
  codigo text,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_catalogo_involucrados_nombre_tipo_activo
  ON public.catalogo_involucrados (lower(nombre), tipo) WHERE activo = true;
CREATE INDEX idx_catalogo_involucrados_tipo ON public.catalogo_involucrados(tipo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_involucrados TO authenticated;
GRANT ALL ON public.catalogo_involucrados TO service_role;

ALTER TABLE public.catalogo_involucrados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_inv read auth" ON public.catalogo_involucrados FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_inv manage supervisor" ON public.catalogo_involucrados
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'supervisor'));

CREATE TRIGGER trg_cat_inv_touch BEFORE UPDATE ON public.catalogo_involucrados
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== Secuencia y tabla relevamientos =====
CREATE SEQUENCE public.relevamientos_numero_seq START 1;

CREATE TABLE public.relevamientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  solicitante text NOT NULL,
  descripcion text NOT NULL,
  involucrado_id uuid REFERENCES public.catalogo_involucrados(id) ON DELETE SET NULL,
  involucrado_tipo text NOT NULL CHECK (involucrado_tipo IN ('equipo','linea','sector')),
  involucrado_nombre text NOT NULL,
  prioridad text NOT NULL CHECK (prioridad IN ('Alta','Media','Baja')),
  estado text NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','Convertido en OIT','Rechazado')),
  oit_id uuid REFERENCES public.ordenes(id) ON DELETE SET NULL,
  motivo_rechazo text,
  created_by uuid NOT NULL,
  updated_by uuid,
  convertido_por uuid,
  convertido_at timestamptz,
  rechazado_por uuid,
  rechazado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_relev_created_at ON public.relevamientos(created_at DESC);
CREATE INDEX idx_relev_estado ON public.relevamientos(estado);
CREATE INDEX idx_relev_oit ON public.relevamientos(oit_id);
CREATE INDEX idx_relev_involucrado ON public.relevamientos(involucrado_id);

GRANT SELECT, INSERT, UPDATE ON public.relevamientos TO authenticated;
GRANT ALL ON public.relevamientos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.relevamientos_numero_seq TO authenticated;

ALTER TABLE public.relevamientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relev read all auth" ON public.relevamientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "relev insert any auth" ON public.relevamientos FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "relev update own pending or supervisor" ON public.relevamientos FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'supervisor')
    OR (created_by = auth.uid() AND estado = 'Pendiente')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'supervisor')
    OR (created_by = auth.uid() AND estado = 'Pendiente')
  );

-- Trigger n\u00famero + auditor\u00eda
CREATE OR REPLACE FUNCTION public.relevamientos_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.numero IS NULL OR NEW.numero = '' THEN
      NEW.numero := 'REL-' || LPAD(nextval('public.relevamientos_numero_seq')::text, 4, '0');
    END IF;
    IF uid IS NOT NULL THEN NEW.created_by := uid; NEW.updated_by := uid; END IF;
    NEW.created_at := now(); NEW.updated_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.numero := OLD.numero;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
    IF uid IS NOT NULL THEN NEW.updated_by := uid; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_relev_before_write
BEFORE INSERT OR UPDATE ON public.relevamientos
FOR EACH ROW EXECUTE FUNCTION public.relevamientos_before_write();

-- ===== Adjuntos =====
CREATE TABLE public.relevamiento_adjuntos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relevamiento_id uuid NOT NULL REFERENCES public.relevamientos(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX idx_relev_adj_relev ON public.relevamiento_adjuntos(relevamiento_id);

GRANT SELECT, INSERT, UPDATE ON public.relevamiento_adjuntos TO authenticated;
GRANT ALL ON public.relevamiento_adjuntos TO service_role;

ALTER TABLE public.relevamiento_adjuntos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "relev_adj read auth" ON public.relevamiento_adjuntos FOR SELECT TO authenticated USING (true);
CREATE POLICY "relev_adj insert auth" ON public.relevamiento_adjuntos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.relevamientos r WHERE r.id = relevamiento_id
      AND (public.has_role(auth.uid(),'supervisor')
           OR (r.created_by = auth.uid() AND r.estado = 'Pendiente')))
  );
CREATE POLICY "relev_adj update auth" ON public.relevamiento_adjuntos FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.relevamientos r WHERE r.id = relevamiento_id
      AND (public.has_role(auth.uid(),'supervisor')
           OR (r.created_by = auth.uid() AND r.estado = 'Pendiente')))
  );

-- ===== Enlace inverso en ordenes =====
ALTER TABLE public.ordenes ADD COLUMN IF NOT EXISTS relevamiento_id uuid REFERENCES public.relevamientos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ordenes_relevamiento ON public.ordenes(relevamiento_id);

-- ===== Storage policies for bucket relevamiento-attachments (bucket se crea aparte v\u00eda tool) =====
CREATE POLICY "relev_att read auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'relevamiento-attachments');
CREATE POLICY "relev_att insert auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'relevamiento-attachments');
CREATE POLICY "relev_att update owner"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'relevamiento-attachments' AND owner = auth.uid());
CREATE POLICY "relev_att delete owner or supervisor"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'relevamiento-attachments' AND (owner = auth.uid() OR public.has_role(auth.uid(),'supervisor')));
