ALTER TABLE public.notificaciones_configuracion 
ADD COLUMN IF NOT EXISTS postmark_template_id integer NOT NULL DEFAULT 41353048;