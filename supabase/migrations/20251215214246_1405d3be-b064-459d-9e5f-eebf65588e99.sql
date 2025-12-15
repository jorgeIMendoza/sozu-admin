-- Add column for ver_todos_proyectos_propiedades to roles table
ALTER TABLE public.roles 
ADD COLUMN IF NOT EXISTS ver_todos_proyectos_propiedades boolean DEFAULT false;