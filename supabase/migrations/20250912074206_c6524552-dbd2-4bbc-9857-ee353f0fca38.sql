-- Create videos_youtube table for project YouTube videos
CREATE TABLE public.videos_youtube (
  id SERIAL PRIMARY KEY,
  id_proyecto INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  url_youtube TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Multimedias_proyecto table for project multimedia
CREATE TABLE public.multimedias_proyecto (
  id SERIAL PRIMARY KEY,
  id_proyecto INTEGER NOT NULL,
  es_imagen BOOLEAN NOT NULL DEFAULT true,
  url TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraints
ALTER TABLE public.videos_youtube 
  ADD CONSTRAINT fk_videos_youtube_proyecto 
  FOREIGN KEY (id_proyecto) REFERENCES public.proyectos(id);

ALTER TABLE public.multimedias_proyecto 
  ADD CONSTRAINT fk_multimedias_proyecto_proyecto 
  FOREIGN KEY (id_proyecto) REFERENCES public.proyectos(id);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_videos_youtube_updated_at
  BEFORE UPDATE ON public.videos_youtube
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_multimedias_proyecto_updated_at
  BEFORE UPDATE ON public.multimedias_proyecto
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();