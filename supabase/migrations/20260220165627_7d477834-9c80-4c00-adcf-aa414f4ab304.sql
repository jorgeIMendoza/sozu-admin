
-- Add showroom fields to proyectos table
ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS descripcion_direccion_showroom text,
  ADD COLUMN IF NOT EXISTS latitud_showroom numeric,
  ADD COLUMN IF NOT EXISTS longitud_showroom numeric;

-- Add a check constraint to ensure all three showroom fields are provided together or none
CREATE OR REPLACE FUNCTION public.validate_showroom_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- If any showroom field is set, all must be set
  IF (NEW.descripcion_direccion_showroom IS NOT NULL OR NEW.latitud_showroom IS NOT NULL OR NEW.longitud_showroom IS NOT NULL) THEN
    IF (NEW.descripcion_direccion_showroom IS NULL OR NEW.latitud_showroom IS NULL OR NEW.longitud_showroom IS NULL) THEN
      RAISE EXCEPTION 'Si se proporciona un campo de showroom, los tres campos (descripcion_direccion_showroom, latitud_showroom, longitud_showroom) deben estar presentes';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_showroom_fields_trigger
  BEFORE INSERT OR UPDATE ON public.proyectos
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_showroom_fields();
