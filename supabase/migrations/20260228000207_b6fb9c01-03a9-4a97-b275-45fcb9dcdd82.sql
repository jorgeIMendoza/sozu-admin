
-- 1. Add submenu "Carta de Acuerdos" under Legal (menu_id = 9)
INSERT INTO submenus (nombre, vista_front_end, menu_id, orden, activo)
VALUES ('Carta de Acuerdos', '/admin/legal/carta-acuerdos', 9, 2, true);

-- 2. Create table for storing the agreement letter template
CREATE TABLE public.carta_acuerdos_template (
  id SERIAL PRIMARY KEY,
  contenido_html TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by TEXT
);

ALTER TABLE public.carta_acuerdos_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read carta template"
  ON public.carta_acuerdos_template FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update carta template"
  ON public.carta_acuerdos_template FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert carta template"
  ON public.carta_acuerdos_template FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

INSERT INTO carta_acuerdos_template (contenido_html, updated_by)
VALUES ('', 'system');

-- 3. Create table for digital signature tracking (Mifiel)
CREATE TABLE public.firmas_digitales (
  id SERIAL PRIMARY KEY,
  tipo_documento TEXT NOT NULL DEFAULT 'carta_acuerdos',
  referencia_id INTEGER,
  mifiel_document_id TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  firmantes JSONB NOT NULL DEFAULT '[]',
  pdf_url TEXT,
  pdf_firmado_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.firmas_digitales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read firmas"
  ON public.firmas_digitales FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert firmas"
  ON public.firmas_digitales FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update firmas"
  ON public.firmas_digitales FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE TRIGGER update_firmas_digitales_updated_at
  BEFORE UPDATE ON public.firmas_digitales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Create storage bucket for signed documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('firmas-digitales', 'firmas-digitales', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can read signed docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'firmas-digitales' AND auth.role() = 'authenticated');

CREATE POLICY "Service can upload signed docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'firmas-digitales' AND auth.role() = 'authenticated');
