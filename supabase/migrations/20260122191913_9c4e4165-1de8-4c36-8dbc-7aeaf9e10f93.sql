
-- Drop and recreate the function with correct schema
DROP FUNCTION IF EXISTS get_cuentas_cobranza_paginadas;

CREATE OR REPLACE FUNCTION get_cuentas_cobranza_paginadas(
  p_page INTEGER DEFAULT 1,
  p_per_page INTEGER DEFAULT 50,
  p_id_cuenta TEXT DEFAULT NULL,
  p_proyecto TEXT DEFAULT NULL,
  p_clabe TEXT DEFAULT NULL,
  p_no_propiedad TEXT DEFAULT NULL,
  p_modelo TEXT DEFAULT NULL,
  p_compradores TEXT DEFAULT NULL,
  p_producto TEXT DEFAULT NULL,
  p_estatus_ids INTEGER[] DEFAULT NULL,
  p_tipos TEXT[] DEFAULT NULL,
  p_activo BOOLEAN DEFAULT TRUE,
  p_proyecto_ids INTEGER[] DEFAULT NULL,
  p_dueno_entity_ids INTEGER[] DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  id_oferta INTEGER,
  precio_final NUMERIC,
  clabe_stp TEXT,
  fecha_compra DATE,
  activo BOOLEAN,
  id_cuenta_cobranza_padre BIGINT,
  id_propiedad INTEGER,
  id_producto INTEGER,
  numero_propiedad TEXT,
  id_estatus_disponibilidad INTEGER,
  estatus_disponibilidad_nombre TEXT,
  id_proyecto INTEGER,
  proyecto TEXT,
  edificio TEXT,
  modelo TEXT,
  comprador TEXT,
  compradores_json JSONB,
  producto TEXT,
  tipo TEXT,
  vendedor TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INTEGER;
  v_total BIGINT;
BEGIN
  v_offset := (p_page - 1) * p_per_page;

  -- Get total count first
  SELECT COUNT(DISTINCT cc.id) INTO v_total
  FROM cuentas_cobranza cc
  LEFT JOIN ofertas o ON o.id = cc.id_oferta
  LEFT JOIN propiedades prop ON prop.id = o.id_propiedad
  LEFT JOIN edificios_modelos em ON em.id = prop.id_edificio_modelo
  LEFT JOIN edificios ed ON ed.id = em.id_edificio
  LEFT JOIN modelos m ON m.id = em.id_modelo
  LEFT JOIN proyectos proj ON proj.id = ed.id_proyecto
  LEFT JOIN productos_servicios ps ON ps.id = o.id_producto
  LEFT JOIN personas pers ON pers.id = o.id_persona_lead
  LEFT JOIN estatus_disponibilidad estat ON estat.id = prop.id_estatus_disponibilidad
  WHERE cc.activo = p_activo
    AND cc.id_cuenta_cobranza_padre IS NULL
    AND (p_id_cuenta IS NULL OR cc.id::TEXT ILIKE '%' || p_id_cuenta || '%')
    AND (p_proyecto IS NULL OR proj.nombre ILIKE '%' || p_proyecto || '%')
    AND (p_clabe IS NULL OR cc.clabe_stp ILIKE '%' || p_clabe || '%')
    AND (p_no_propiedad IS NULL OR prop.numero_propiedad ILIKE '%' || p_no_propiedad || '%')
    AND (p_modelo IS NULL OR m.nombre ILIKE '%' || p_modelo || '%')
    AND (p_producto IS NULL OR ps.nombre ILIKE '%' || p_producto || '%')
    AND (p_compradores IS NULL OR pers.nombre_legal ILIKE '%' || p_compradores || '%')
    AND (p_estatus_ids IS NULL OR prop.id_estatus_disponibilidad = ANY(p_estatus_ids))
    AND (p_tipos IS NULL OR 
      (CASE 
        WHEN o.id_producto IS NOT NULL THEN 'Producto'
        WHEN o.id_propiedad IS NOT NULL THEN 'Propiedad'
        ELSE 'Servicio'
      END) = ANY(p_tipos)
    )
    AND (p_proyecto_ids IS NULL OR ed.id_proyecto = ANY(p_proyecto_ids))
    AND (p_dueno_entity_ids IS NULL OR prop.id_entidad_relacionada_dueno = ANY(p_dueno_entity_ids));

  -- Return paginated results
  RETURN QUERY
  SELECT 
    cc.id,
    cc.id_oferta,
    cc.precio_final,
    cc.clabe_stp,
    cc.fecha_compra,
    cc.activo,
    cc.id_cuenta_cobranza_padre,
    o.id_propiedad,
    o.id_producto,
    prop.numero_propiedad,
    prop.id_estatus_disponibilidad,
    estat.nombre AS estatus_disponibilidad_nombre,
    ed.id_proyecto,
    proj.nombre AS proyecto,
    ed.nombre AS edificio,
    m.nombre AS modelo,
    pers.nombre_legal AS comprador,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id_persona', comp.id_persona,
        'nombre_legal', p_comp.nombre_legal,
        'rfc', p_comp.rfc,
        'porcentaje_copropiedad', comp.porcentaje_copropiedad
      ))
      FROM compradores comp
      JOIN personas p_comp ON p_comp.id = comp.id_persona
      WHERE comp.id_cuenta_cobranza = cc.id AND comp.activo = true
    ) AS compradores_json,
    ps.nombre AS producto,
    CASE 
      WHEN o.id_producto IS NOT NULL THEN 'Producto'
      WHEN o.id_propiedad IS NOT NULL THEN 'Propiedad'
      ELSE 'Servicio'
    END AS tipo,
    o.email_creador AS vendedor,
    v_total AS total_count
  FROM cuentas_cobranza cc
  LEFT JOIN ofertas o ON o.id = cc.id_oferta
  LEFT JOIN propiedades prop ON prop.id = o.id_propiedad
  LEFT JOIN edificios_modelos em ON em.id = prop.id_edificio_modelo
  LEFT JOIN edificios ed ON ed.id = em.id_edificio
  LEFT JOIN modelos m ON m.id = em.id_modelo
  LEFT JOIN proyectos proj ON proj.id = ed.id_proyecto
  LEFT JOIN productos_servicios ps ON ps.id = o.id_producto
  LEFT JOIN personas pers ON pers.id = o.id_persona_lead
  LEFT JOIN estatus_disponibilidad estat ON estat.id = prop.id_estatus_disponibilidad
  WHERE cc.activo = p_activo
    AND cc.id_cuenta_cobranza_padre IS NULL
    AND (p_id_cuenta IS NULL OR cc.id::TEXT ILIKE '%' || p_id_cuenta || '%')
    AND (p_proyecto IS NULL OR proj.nombre ILIKE '%' || p_proyecto || '%')
    AND (p_clabe IS NULL OR cc.clabe_stp ILIKE '%' || p_clabe || '%')
    AND (p_no_propiedad IS NULL OR prop.numero_propiedad ILIKE '%' || p_no_propiedad || '%')
    AND (p_modelo IS NULL OR m.nombre ILIKE '%' || p_modelo || '%')
    AND (p_producto IS NULL OR ps.nombre ILIKE '%' || p_producto || '%')
    AND (p_compradores IS NULL OR pers.nombre_legal ILIKE '%' || p_compradores || '%')
    AND (p_estatus_ids IS NULL OR prop.id_estatus_disponibilidad = ANY(p_estatus_ids))
    AND (p_tipos IS NULL OR 
      (CASE 
        WHEN o.id_producto IS NOT NULL THEN 'Producto'
        WHEN o.id_propiedad IS NOT NULL THEN 'Propiedad'
        ELSE 'Servicio'
      END) = ANY(p_tipos)
    )
    AND (p_proyecto_ids IS NULL OR ed.id_proyecto = ANY(p_proyecto_ids))
    AND (p_dueno_entity_ids IS NULL OR prop.id_entidad_relacionada_dueno = ANY(p_dueno_entity_ids))
  ORDER BY cc.id DESC
  LIMIT p_per_page
  OFFSET v_offset;
END;
$$;
