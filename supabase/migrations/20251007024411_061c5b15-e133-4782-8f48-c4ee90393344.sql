-- Agregar columna id_conyuge a la tabla personas
ALTER TABLE public.personas
ADD COLUMN id_conyuge INTEGER REFERENCES public.personas(id);

-- Crear índice para mejorar el rendimiento de las búsquedas
CREATE INDEX idx_personas_id_conyuge ON public.personas(id_conyuge);

-- Comentario para documentar el campo
COMMENT ON COLUMN public.personas.id_conyuge IS 'ID del cónyuge cuando el estado civil es "Casado(a) bienes mancomunados". La relación debe ser recíproca.';