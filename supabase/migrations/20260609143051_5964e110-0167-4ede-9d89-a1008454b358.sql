
-- SECTORS
CREATE TABLE public.sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sectors_name_ci_uidx ON public.sectors (lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sectors TO authenticated;
GRANT ALL ON public.sectors TO service_role;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sectors read auth" ON public.sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "sectors insert sup" ON public.sectors FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "sectors update sup" ON public.sectors FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'supervisor')) WITH CHECK (public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "sectors delete sup" ON public.sectors FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'supervisor'));
CREATE TRIGGER sectors_touch BEFORE UPDATE ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.sectors (name, sort_order) VALUES
  ('Mantenimiento', 10), ('Producción', 20), ('Limpieza', 30);

-- PEOPLE
CREATE TABLE public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  can_be_requester BOOLEAN NOT NULL DEFAULT true,
  can_be_technician BOOLEAN NOT NULL DEFAULT true,
  can_be_quality_responsible BOOLEAN NOT NULL DEFAULT true,
  can_be_created_by BOOLEAN NOT NULL DEFAULT true,
  can_be_reviewed_by BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX people_name_ci_uidx ON public.people (lower(full_name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "people read auth" ON public.people FOR SELECT TO authenticated USING (true);
CREATE POLICY "people insert sup" ON public.people FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "people update sup" ON public.people FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'supervisor')) WITH CHECK (public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "people delete sup" ON public.people FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'supervisor'));
CREATE TRIGGER people_touch BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.people (full_name) VALUES
  ('Pablo Guerra'), ('Ayelen Villarino'), ('Mauro Alexio'), ('Nicolás Buldain');

-- EQUIPMENT
CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX equipment_code_ci_uidx ON public.equipment (lower(code));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment TO authenticated;
GRANT ALL ON public.equipment TO service_role;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipment read auth" ON public.equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipment insert sup" ON public.equipment FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "equipment update sup" ON public.equipment FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'supervisor')) WITH CHECK (public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "equipment delete sup" ON public.equipment FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'supervisor'));
CREATE TRIGGER equipment_touch BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.equipment (code, name) VALUES
  ('EX1','EXTRUSORA'),('EX2','EXTRUSORA'),('EX3','EXTRUSORA'),('EXMN 1','EXTRUSORA'),
  ('M1','MEZCLADORA'),('M2','MEZCLADORA'),('M3','MEZCLADORA'),
  ('D6','DOSIFICADOR'),('D4','DOSIFICADOR'),('D5','DOSIFICADOR'),
  ('C1','CORTANTE CONO 8T'),('C2','CORTANTE CONO 8T'),('C3','CORTANTE CONO 8T'),
  ('C4','CORTANTE NACHO'),('C5','CORTANTE CONO 12T'),('C6','CORTANTE CASCARITA'),
  ('C7','CORTANTE PANCETITA'),('C8','CORTANTE CONO 8T'),
  ('PP1','PINTADOR'),
  ('CE1','CINTA ENFRIADORA'),('CE2','CINTA ENFRIADORA'),('CE3','CINTA ENFRIADORA'),
  ('CE4','CINTA ENFRIADORA'),('CE5','CINTA ENFRIADORA'),('CE6','CINTA ENFRIADORA'),
  ('CE7','CINTA ENFRIADORA'),('CE8','CINTA ENFRIADORA'),
  ('CZ1','CINTA Z1'),('CZ2','CINTA Z2'),
  ('CEL1','CINTA ELEVADORA'),('CEL2','CINTA ELEVADORA'),
  ('TPV1','TRANSPORTE POR VACIO'),('TPV2','TRANSPORTE POR VACIO'),
  ('TN1','TRANSPORTE NEUMATICO'),
  ('PO1','PRESECADOR OSCILANTE'),('PR1','PRESECADOR ROTATIVO'),
  ('H1','HORNO'),('H2','HORNO'),('H3','HORNO'),
  ('BVE1','BANDEJA VIBRATORIA'),('BVE2','BANDEJA VIBRATORIA'),
  ('S1','SELLADORA'),('S2','SELLADORA'),('S3','SELLADORA'),('S4','SELLADORA'),
  ('CP1','COMPRESOR'),('CP2','COMPRESOR'),
  ('CL1','CALDERA'),('EF1','ENFILMADORA'),
  ('CH1','CHILLER'),('CH2','CHILLER'),('CH3','CHILLER'),('CH 4','CHILLER'),
  ('F1','FREIDOR'),('F2','FREIDOR'),('F3','FREIDOR'),('F4','FREIDOR'),
  ('CCD1','CELDA DE CARGA DOSIFICADOR'),
  ('Z1','ZORRA'),('Z2','ZORRA'),('Z3','ZORRA'),('Z4','ZORRA'),
  ('TJ1','TIJERA'),
  ('AU1','CLARK ELECTRICO'),('AU2','CLARK ELECTRICO'),
  ('LP1','LAVADORA DE PISO'),
  ('ET1','ETIQUETADORA'),('ET2','ETIQUETADORA'),('ET3','ETIQUETADORA'),
  ('AS1','ASPIRADORA'),('AS2','ASPIRADORA'),
  ('GE1','GRUPO ELECTROGENO'),('GE2','GRUPO ELECTROGENO'),
  ('AP1','APILADOR'),
  ('HD 1','HIDROLAVADORA'),('HD 2','HIDROLAVADORA');
