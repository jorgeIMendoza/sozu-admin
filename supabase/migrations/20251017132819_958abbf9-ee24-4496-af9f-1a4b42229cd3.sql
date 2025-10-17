-- Función segura para ejecutar consultas SQL dinámicas
-- Solo permite SELECT y limita resultados

CREATE OR REPLACE FUNCTION execute_safe_query(
    query_text TEXT,
    max_rows INTEGER DEFAULT 1000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
DECLARE
    result JSONB;
    query_upper TEXT;
BEGIN
    -- Convertir a mayúsculas para validación
    query_upper := UPPER(TRIM(query_text));
    
    -- Validar que sea SELECT
    IF NOT query_upper LIKE 'SELECT %' THEN
        RAISE EXCEPTION 'Solo se permiten consultas SELECT';
    END IF;
    
    -- Validar palabras clave peligrosas
    IF query_upper ~ '(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|EXEC|EXECUTE)' THEN
        RAISE EXCEPTION 'Consulta contiene palabras clave no permitidas';
    END IF;
    
    -- No permitir múltiples consultas
    IF query_text LIKE '%;%' THEN
        RAISE EXCEPTION 'No se permiten múltiples consultas';
    END IF;
    
    -- Agregar LIMIT si no existe
    IF NOT query_upper LIKE '%LIMIT%' THEN
        query_text := query_text || ' LIMIT ' || max_rows;
    END IF;
    
    -- Ejecutar query y convertir a JSONB
    EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result;
    
    -- Si result es null, retornar array vacío
    IF result IS NULL THEN
        result := '[]'::JSONB;
    END IF;
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error ejecutando consulta: %', SQLERRM;
END;
$$;

-- Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION execute_safe_query(TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION execute_safe_query IS 'Ejecuta consultas SQL SELECT de forma segura con validaciones y límites';