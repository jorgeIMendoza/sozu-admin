
-- Table to link tipos_cita to proyectos (many-to-many)
CREATE TABLE public.tipos_cita_proyectos (
  id SERIAL PRIMARY KEY,
  id_tipo_cita INTEGER NOT NULL REFERENCES public.tipos_cita(id) ON DELETE CASCADE,
  id_proyecto INTEGER NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(id_tipo_cita, id_proyecto)
);

-- Enable RLS
ALTER TABLE public.tipos_cita_proyectos ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read tipos_cita_proyectos"
ON public.tipos_cita_proyectos
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Authenticated users can insert tipos_cita_proyectos"
ON public.tipos_cita_proyectos
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete tipos_cita_proyectos"
ON public.tipos_cita_proyectos
FOR DELETE
TO authenticated
USING (true);
