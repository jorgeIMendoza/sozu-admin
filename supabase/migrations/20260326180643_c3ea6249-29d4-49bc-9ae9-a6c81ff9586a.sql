CREATE TABLE public.citas_horarios_overrides (
  id SERIAL PRIMARY KEY,
  id_configuracion_cita INTEGER NOT NULL REFERENCES public.configuracion_citas_usuarios(id) ON DELETE CASCADE,
  id_horario INTEGER NOT NULL REFERENCES public.configuracion_citas_horarios(id) ON DELETE CASCADE,
  fecha_original DATE NOT NULL,
  hora_original INTEGER NOT NULL,
  fecha_nueva DATE NOT NULL,
  hora_nueva INTEGER NOT NULL,
  movido_por TEXT,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  activo BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(id_horario, fecha_original)
);

ALTER TABLE public.citas_horarios_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read overrides"
ON public.citas_horarios_overrides
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert overrides"
ON public.citas_horarios_overrides
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update overrides"
ON public.citas_horarios_overrides
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);