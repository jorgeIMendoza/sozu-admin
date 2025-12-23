-- Create table to store which reports each role can access
CREATE TABLE public.roles_reportes (
    id SERIAL PRIMARY KEY,
    rol_id INTEGER NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    reporte_id INTEGER NOT NULL REFERENCES public.reportes(id) ON DELETE CASCADE,
    activo BOOLEAN NOT NULL DEFAULT true,
    fecha_creacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rol_id, reporte_id)
);

-- Enable RLS
ALTER TABLE public.roles_reportes ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read
CREATE POLICY "Allow authenticated users to read roles_reportes" 
ON public.roles_reportes 
FOR SELECT 
TO authenticated
USING (true);

-- Insert permissions for all roles with reportes/finanzas access to all reports
-- Get all roles except Super Admin (1) and Representante de empresa dueña (14)
-- Super Admin has implicit access, Representante only gets report ID 1

-- Insert for all roles except Super Admin and Representante de empresa dueña - they get all reports
INSERT INTO public.roles_reportes (rol_id, reporte_id)
SELECT r.id, rep.id
FROM roles r
CROSS JOIN reportes rep
WHERE r.activo = true
AND r.id NOT IN (1, 14)  -- Exclude Super Admin (implicit access) and Representante (special access)
AND rep.activo = true;

-- Insert for Representante de empresa dueña (14) - ONLY report ID 1 (Cuentas por cobrar de propiedades)
INSERT INTO public.roles_reportes (rol_id, reporte_id)
VALUES (14, 1);

-- Create function to check if a user can access a specific report
CREATE OR REPLACE FUNCTION public.user_can_access_report(
    _reporte_id INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _rol_id INTEGER;
    _rol_nombre TEXT;
    _has_access BOOLEAN;
BEGIN
    -- Get current user's role
    SELECT rol_id, rol_nombre INTO _rol_id, _rol_nombre
    FROM usuarios
    WHERE email = auth.email();
    
    -- Super Admin has access to everything
    IF _rol_nombre = 'Super Administrador' THEN
        RETURN TRUE;
    END IF;
    
    -- Check if role has access to this specific report
    SELECT EXISTS (
        SELECT 1
        FROM roles_reportes
        WHERE rol_id = _rol_id
        AND reporte_id = _reporte_id
        AND activo = true
    ) INTO _has_access;
    
    RETURN _has_access;
END;
$$;

-- Create function to get all accessible report IDs for current user
CREATE OR REPLACE FUNCTION public.get_accessible_report_ids()
RETURNS SETOF INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _rol_id INTEGER;
    _rol_nombre TEXT;
BEGIN
    -- Get current user's role
    SELECT rol_id, rol_nombre INTO _rol_id, _rol_nombre
    FROM usuarios
    WHERE email = auth.email();
    
    -- Super Admin has access to all active reports
    IF _rol_nombre = 'Super Administrador' THEN
        RETURN QUERY SELECT id FROM reportes WHERE activo = true;
        RETURN;
    END IF;
    
    -- Return report IDs the role has access to
    RETURN QUERY
    SELECT rr.reporte_id
    FROM roles_reportes rr
    WHERE rr.rol_id = _rol_id
    AND rr.activo = true;
END;
$$;