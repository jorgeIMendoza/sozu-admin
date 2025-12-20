-- =============================================
-- SISTEMA DE REPORTES REUTILIZABLE
-- =============================================

-- 1. Agregar PRIMARY KEY a submenus si no existe
ALTER TABLE public.submenus ADD CONSTRAINT submenus_pkey PRIMARY KEY (id);

-- 2. Crear tabla de reportes
CREATE TABLE public.reportes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    query_sql TEXT NOT NULL,
    filtros_configuracion JSONB DEFAULT '[]'::jsonb,
    nombre_archivo TEXT NOT NULL,
    id_submenu INTEGER REFERENCES public.submenus(id),
    activo BOOLEAN NOT NULL DEFAULT true,
    fecha_creacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para actualizar fecha_actualizacion
CREATE TRIGGER update_reportes_updated_at
    BEFORE UPDATE ON public.reportes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para mejor rendimiento
CREATE INDEX idx_reportes_submenu ON public.reportes(id_submenu) WHERE activo = true;
CREATE INDEX idx_reportes_activo ON public.reportes(activo);

-- RLS para reportes
ALTER TABLE public.reportes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver reportes activos"
    ON public.reportes
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Solo admins pueden modificar reportes"
    ON public.reportes
    FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

-- 3. Crear nuevo menú "Reportes"
INSERT INTO public.menus (nombre, activo) VALUES ('Reportes', true);

-- 4. Crear submenús para Reportes (menu_id = 11)
INSERT INTO public.submenus (menu_id, nombre, vista_front_end, activo) 
VALUES (11, 'Inventarios', '/admin/reportes/inventarios', true);

INSERT INTO public.submenus (menu_id, nombre, vista_front_end, activo) 
VALUES (11, 'Finanzas', '/admin/reportes/finanzas', true);

-- 5. Crear submenu "Configuración de Reportes" en Sistema (menu_id = 10)
INSERT INTO public.submenus (menu_id, nombre, vista_front_end, activo) 
VALUES (10, 'Configuración de Reportes', '/admin/configuracion-reportes', true);