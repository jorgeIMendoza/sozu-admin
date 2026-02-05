-- Add orden column to submenus table
ALTER TABLE public.submenus ADD COLUMN orden integer DEFAULT 100;

-- Set initial order based on current id (preserving existing order)
UPDATE public.submenus SET orden = id;