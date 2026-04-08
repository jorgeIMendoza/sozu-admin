-- Drop the old unique constraint that doesn't account for different configurations
ALTER TABLE public.configuracion_citas_horarios 
DROP CONSTRAINT configuracion_citas_horarios_unique;

-- Create a new unique constraint that includes id_configuracion_cita
ALTER TABLE public.configuracion_citas_horarios 
ADD CONSTRAINT configuracion_citas_horarios_unique 
UNIQUE (id_configuracion_cita, dia_semana, hora);