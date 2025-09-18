-- Add column to multimedias_modelo table to track which multimedia is used as location in offer
ALTER TABLE public.multimedias_modelo 
ADD COLUMN ver_como_ubicacion_en_oferta boolean NOT NULL DEFAULT false;

-- Ensure only one multimedia per model can be marked as location in offer
-- Create a function to enforce single selection
CREATE OR REPLACE FUNCTION enforce_single_ubicacion_oferta()
RETURNS TRIGGER AS $$
BEGIN
  -- If the new/updated record has ver_como_ubicacion_en_oferta = true
  IF NEW.ver_como_ubicacion_en_oferta = true THEN
    -- Set all other multimedia for this model to false
    UPDATE public.multimedias_modelo 
    SET ver_como_ubicacion_en_oferta = false 
    WHERE id_modelo = NEW.id_modelo 
    AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single selection
CREATE TRIGGER trigger_single_ubicacion_oferta
  BEFORE INSERT OR UPDATE ON public.multimedias_modelo
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_ubicacion_oferta();