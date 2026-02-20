
CREATE TABLE public.showrooms_proyecto (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_proyecto INTEGER NOT NULL REFERENCES public.proyectos(id),
  descripcion_direccion TEXT NOT NULL,
  latitud NUMERIC NOT NULL,
  longitud NUMERIC NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fecha_actualizacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Migrate existing data
INSERT INTO public.showrooms_proyecto (id_proyecto, descripcion_direccion, latitud, longitud)
SELECT id, descripcion_direccion_showroom, latitud_showroom, longitud_showroom
FROM public.proyectos
WHERE descripcion_direccion_showroom IS NOT NULL
  AND latitud_showroom IS NOT NULL
  AND longitud_showroom IS NOT NULL;

-- Drop old trigger and function
DROP TRIGGER IF EXISTS validate_showroom_fields_trigger ON public.proyectos;
DROP FUNCTION IF EXISTS public.validate_showroom_fields();

-- Drop old columns
ALTER TABLE public.proyectos DROP COLUMN IF EXISTS descripcion_direccion_showroom;
ALTER TABLE public.proyectos DROP COLUMN IF EXISTS latitud_showroom;
ALTER TABLE public.proyectos DROP COLUMN IF EXISTS longitud_showroom;

-- Enable RLS
ALTER TABLE public.showrooms_proyecto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read showrooms"
ON public.showrooms_proyecto FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert showrooms"
ON public.showrooms_proyecto FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update showrooms"
ON public.showrooms_proyecto FOR UPDATE
TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete showrooms"
ON public.showrooms_proyecto FOR DELETE
TO authenticated USING (true);

-- Index
CREATE INDEX idx_showrooms_proyecto_id_proyecto ON public.showrooms_proyecto(id_proyecto);
