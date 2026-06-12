
CREATE TABLE public.work_order_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.ordenes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_woa_order_active ON public.work_order_attachments(work_order_id) WHERE active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_attachments TO authenticated;
GRANT ALL ON public.work_order_attachments TO service_role;

ALTER TABLE public.work_order_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WOA read" ON public.work_order_attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "WOA insert" ON public.work_order_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'supervisor') OR
    public.has_role(auth.uid(),'calidad') OR
    public.has_role(auth.uid(),'operario') OR
    public.has_role(auth.uid(),'panol')
  );

CREATE POLICY "WOA update" ON public.work_order_attachments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'supervisor') OR uploaded_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'supervisor') OR uploaded_by = auth.uid());

CREATE POLICY "WOA delete" ON public.work_order_attachments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'supervisor'));

CREATE TRIGGER trg_woa_updated_at BEFORE UPDATE ON public.work_order_attachments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage RLS for the private bucket (created via storage tool)
CREATE POLICY "WO attachments read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'work-order-attachments');

CREATE POLICY "WO attachments upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'work-order-attachments' AND (
      public.has_role(auth.uid(),'supervisor') OR
      public.has_role(auth.uid(),'calidad') OR
      public.has_role(auth.uid(),'operario') OR
      public.has_role(auth.uid(),'panol')
    )
  );

CREATE POLICY "WO attachments delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'work-order-attachments' AND
    public.has_role(auth.uid(),'supervisor')
  );
