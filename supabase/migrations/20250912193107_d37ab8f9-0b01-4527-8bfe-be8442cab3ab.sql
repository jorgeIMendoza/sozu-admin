-- Add url_logo column to personas table
ALTER TABLE public.personas 
ADD COLUMN url_logo TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN public.personas.url_logo IS 'URL of the logo image for the entity';