-- Add id_propiedad field to videos_youtube table
ALTER TABLE videos_youtube 
ADD COLUMN id_propiedad integer;

-- Add foreign key constraint to relate with propiedades table
ALTER TABLE videos_youtube 
ADD CONSTRAINT fk_videos_youtube_propiedad 
FOREIGN KEY (id_propiedad) REFERENCES propiedades(id);