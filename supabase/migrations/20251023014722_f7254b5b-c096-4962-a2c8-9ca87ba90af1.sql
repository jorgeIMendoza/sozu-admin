-- Rename column from id_tipo_espacio_rentable to id_tipo_espacio_reservable
ALTER TABLE public.espacios_reservables_edificio 
  RENAME COLUMN id_tipo_espacio_rentable TO id_tipo_espacio_reservable;

-- Drop old foreign key constraint
ALTER TABLE public.espacios_reservables_edificio 
  DROP CONSTRAINT espacios_rentables_edificio_id_tipo_espacio_rentable_fkey;

-- Add new foreign key constraint with correct name
ALTER TABLE public.espacios_reservables_edificio 
  ADD CONSTRAINT espacios_reservables_edificio_id_tipo_espacio_reservable_fkey 
  FOREIGN KEY (id_tipo_espacio_reservable) REFERENCES tipos_espacio_reservables(id);