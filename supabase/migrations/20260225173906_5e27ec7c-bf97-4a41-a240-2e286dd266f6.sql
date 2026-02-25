
-- Create puntos_interes_proyecto table
CREATE TABLE public.puntos_interes_proyecto (
  id SERIAL PRIMARY KEY,
  id_proyecto INTEGER NOT NULL REFERENCES public.proyectos(id),
  nombre TEXT NOT NULL,
  distancia_km NUMERIC(10,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fecha_actualizacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.puntos_interes_proyecto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view puntos_interes" ON public.puntos_interes_proyecto
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert puntos_interes" ON public.puntos_interes_proyecto
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update puntos_interes" ON public.puntos_interes_proyecto
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete puntos_interes" ON public.puntos_interes_proyecto
  FOR DELETE USING (auth.role() = 'authenticated');

-- Insert tipo_documento for Ficha Técnica (id=49, same category as Brochure=10)
INSERT INTO public.tipos_documento (id, nombre, id_categoria_documento, activo)
VALUES (49, 'Ficha Técnica', 10, true)
ON CONFLICT (id) DO NOTHING;
