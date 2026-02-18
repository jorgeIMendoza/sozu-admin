-- Add ver_como_imagen_de_propiedad boolean column to multimedias_modelo
ALTER TABLE public.multimedias_modelo
ADD COLUMN ver_como_imagen_de_propiedad boolean NOT NULL DEFAULT false;