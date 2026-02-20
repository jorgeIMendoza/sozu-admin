
-- 1. Tabla tipos_cita
CREATE TABLE public.tipos_cita (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_cita ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tipos_cita"
  ON public.tipos_cita FOR SELECT TO authenticated USING (true);

-- Seed initial types
INSERT INTO public.tipos_cita (nombre) VALUES ('Capacitación'), ('Visita Showroom');

-- 2. Tabla configuracion_citas_usuarios
CREATE TABLE public.configuracion_citas_usuarios (
  id SERIAL PRIMARY KEY,
  id_usuario_email TEXT NOT NULL,
  id_tipo_cita INTEGER NOT NULL REFERENCES public.tipos_cita(id),
  duracion_minutos INTEGER NOT NULL DEFAULT 60 CHECK (duracion_minutos IN (30, 60, 90, 120)),
  calendario_email TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(id_usuario_email, id_tipo_cita)
);

ALTER TABLE public.configuracion_citas_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read configuracion_citas_usuarios"
  ON public.configuracion_citas_usuarios FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert configuracion_citas_usuarios"
  ON public.configuracion_citas_usuarios FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update configuracion_citas_usuarios"
  ON public.configuracion_citas_usuarios FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete configuracion_citas_usuarios"
  ON public.configuracion_citas_usuarios FOR DELETE TO authenticated USING (true);

-- 3. Add id_tipo_cita to configuracion_citas_horarios
ALTER TABLE public.configuracion_citas_horarios 
  ADD COLUMN id_tipo_cita INTEGER REFERENCES public.tipos_cita(id) DEFAULT 1;

-- Update existing records
UPDATE public.configuracion_citas_horarios SET id_tipo_cita = 1 WHERE id_tipo_cita IS NULL;

-- Drop old unique constraint and create new one including id_tipo_cita
-- First find and drop existing unique constraint
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name
  FROM information_schema.table_constraints tc
  WHERE tc.table_name = 'configuracion_citas_horarios'
    AND tc.constraint_type = 'UNIQUE'
  LIMIT 1;
  
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.configuracion_citas_horarios DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.configuracion_citas_horarios 
  ADD CONSTRAINT configuracion_citas_horarios_unique 
  UNIQUE (id_usuario_email, dia_semana, hora, id_tipo_cita);
