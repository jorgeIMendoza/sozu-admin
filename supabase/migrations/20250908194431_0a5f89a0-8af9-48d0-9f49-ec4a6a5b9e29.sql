-- Remove numero_amenidades column from proyectos table as it's now handled via many-to-many relationship
ALTER TABLE public.proyectos 
DROP COLUMN numero_amenidades;