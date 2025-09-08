-- Remove numero_edificios column from proyectos table since it's redundant
-- The number of buildings can be calculated from the edificios table
ALTER TABLE public.proyectos 
DROP COLUMN numero_edificios;