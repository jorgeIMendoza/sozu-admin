ALTER TABLE public.notificaciones_configuracion 
ADD COLUMN IF NOT EXISTS mapeo_variables_postmark jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.notificaciones_configuracion.mapeo_variables_postmark IS 'Mapeo de variables de la plantilla Postmark. Ej: {"nombre_desarrollo": "{nombre_desarrollo}", "fecha": "{fecha}"}';