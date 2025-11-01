-- Eliminar foreign keys duplicados en proyectos
-- Mantener solo fk_proyectos_direccion_id_pais, fk_proyectos_direccion_id_estado, fk_proyectos_direccion_id_municipio

-- Para paises
ALTER TABLE public.proyectos 
DROP CONSTRAINT IF EXISTS proyectos_direccion_id_pais_fkey,
DROP CONSTRAINT IF EXISTS proyectos_direccion_id_pais_fkey1;

-- Para estados_mx
ALTER TABLE public.proyectos 
DROP CONSTRAINT IF EXISTS proyectos_direccion_id_estado_fkey,
DROP CONSTRAINT IF EXISTS proyectos_direccion_id_estado_fkey1;

-- Para municipios_mx
ALTER TABLE public.proyectos 
DROP CONSTRAINT IF EXISTS proyectos_direccion_id_municipio_fkey,
DROP CONSTRAINT IF EXISTS proyectos_direccion_id_municipio_fkey1;

-- Asegurar que existen los foreign keys correctos (si no existen, crearlos)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_proyectos_direccion_id_pais' 
    AND table_name = 'proyectos'
  ) THEN
    ALTER TABLE public.proyectos 
    ADD CONSTRAINT fk_proyectos_direccion_id_pais 
    FOREIGN KEY (direccion_id_pais) 
    REFERENCES public.paises(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_proyectos_direccion_id_estado' 
    AND table_name = 'proyectos'
  ) THEN
    ALTER TABLE public.proyectos 
    ADD CONSTRAINT fk_proyectos_direccion_id_estado 
    FOREIGN KEY (direccion_id_estado) 
    REFERENCES public.estados_mx(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_proyectos_direccion_id_municipio' 
    AND table_name = 'proyectos'
  ) THEN
    ALTER TABLE public.proyectos 
    ADD CONSTRAINT fk_proyectos_direccion_id_municipio 
    FOREIGN KEY (direccion_id_municipio) 
    REFERENCES public.municipios_mx(id);
  END IF;
END $$;