-- Drop existing function
DROP FUNCTION IF EXISTS get_cuentas_cobranza_paginadas(
  INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT[], TEXT[], BOOLEAN, INT[], INT[]
);

-- Recreate the function with correct column references
CREATE OR REPLACE FUNCTION get_cuentas_cobranza_paginadas(
  p_page INT DEFAULT 1,
  p_per_page INT DEFAULT 50,
  p_id_cuenta TEXT DEFAULT NULL,
  p_proyecto TEXT DEFAULT NULL,
  p_clabe TEXT DEFAULT NULL,
  p_no_propiedad TEXT DEFAULT NULL,
  p_modelo TEXT DEFAULT NULL,
  p_compradores TEXT DEFAULT NULL,
  p_producto TEXT DEFAULT NULL,
  p_estatus_ids INT[] DEFAULT NULL,
  p_tipos TEXT[] DEFAULT NULL,
  p_activo BOOLEAN DEFAULT TRUE,
  p_proyecto_ids INT[] DEFAULT NULL,
  p_dueno_entity_ids INT[] DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  clabe_stp TEXT,
  fecha_compra DATE,
  precio_final NUMERIC,
  activo BOOLEAN,
  id_oferta INT,
  id_cuenta_cobranza_padre BIGINT,
  numero_propiedad TEXT,
  modelo TEXT,
  proyecto TEXT,
  edificio TEXT,
  id_proyecto INT,
  id_estatus_disponibilidad INT,
  estatus_disponibilidad TEXT,
  compradores JSONB,
  vendedor TEXT,
  producto TEXT,
  tipo TEXT,
  pagos_efectivo JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INT;
  v_total BIGINT;
BEGIN
  v_offset := (p_page - 1) * p_per_page;

  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM cuentas_cobranza cc
  LEFT JOIN ofertas o ON cc.id_oferta = o.id
  LEFT JOIN propiedades prop ON o.id_propiedad = prop.id
  LEFT JOIN edificios_modelos em ON prop.id_edificio_modelo = em.id
  LEFT JOIN edificios edif ON em.id_edificio = edif.id
  LEFT JOIN modelos m ON em.id_modelo = m.id
  LEFT JOIN proyectos proy ON COALESCE(edif.id_proyecto, (SELECT ps.id_proyecto FROM productos_servicios ps WHERE ps.id = o.id_producto)) = proy.id
  LEFT JOIN estatus_disponibilidad ed ON prop.id_estatus_disponibilidad = ed.id
  LEFT JOIN productos_servicios ps ON o.id_producto = ps.id
  WHERE cc.activo = p_activo
    AND (p_id_cuenta IS NULL OR cc.id::TEXT ILIKE '%' || p_id_cuenta || '%')
    AND (p_clabe IS NULL OR cc.clabe_stp ILIKE '%' || p_clabe || '%')
    AND (p_no_propiedad IS NULL OR prop.numero ILIKE '%' || p_no_propiedad || '%')
    AND (p_modelo IS NULL OR m.nombre ILIKE '%' || p_modelo || '%')
    AND (p_proyecto IS NULL OR proy.nombre ILIKE '%' || p_proyecto || '%')
    AND (p_producto IS NULL OR ps.nombre ILIKE '%' || p_producto || '%')
    AND (p_estatus_ids IS NULL OR prop.id_estatus_disponibilidad = ANY(p_estatus_ids))
    AND (p_tipos IS NULL OR 
      CASE 
        WHEN o.id_propiedad IS NOT NULL THEN 'Propiedad'
        WHEN o.id_producto IS NOT NULL THEN 'Producto'
        ELSE 'Servicio'
      END = ANY(p_tipos))
    AND (p_proyecto_ids IS NULL OR COALESCE(edif.id_proyecto, ps.id_proyecto) = ANY(p_proyecto_ids))
    AND (p_dueno_entity_ids IS NULL OR prop.id_persona_dueno = ANY(p_dueno_entity_ids));

  -- Return paginated data
  RETURN QUERY
  SELECT 
    cc.id,
    cc.clabe_stp,
    cc.fecha_compra,
    cc.precio_final,
    cc.activo,
    cc.id_oferta,
    cc.id_cuenta_cobranza_padre,
    prop.numero AS numero_propiedad,
    m.nombre AS modelo,
    proy.nombre AS proyecto,
    edif.nombre AS edificio,
    COALESCE(edif.id_proyecto, ps.id_proyecto)::INT AS id_proyecto,
    prop.id_estatus_disponibilidad::INT,
    ed.nombre AS estatus_disponibilidad,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id_persona', oc.id_persona,
        'nombre', pers.nombre_legal,
        'rfc', pers.rfc,
        'porcentaje', oc.porcentaje_participacion
      ))
      FROM ofertas_compradores oc
      JOIN personas pers ON oc.id_persona = pers.id
      WHERE oc.id_oferta = o.id AND oc.activo = true
    ) AS compradores,
    (
      SELECT pv.nombre_legal
      FROM ofertas_vendedores ov
      JOIN personas pv ON ov.id_persona = pv.id
      WHERE ov.id_oferta = o.id AND ov.activo = true
      LIMIT 1
    ) AS vendedor,
    ps.nombre AS producto,
    CASE 
      WHEN o.id_propiedad IS NOT NULL THEN 'Propiedad'
      WHEN o.id_producto IS NOT NULL THEN 'Producto'
      ELSE 'Servicio'
    END AS tipo,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'fecha_pago', pe.fecha_pago,
        'monto', pe.monto
      ))
      FROM pagos pe
      WHERE pe.id_cuenta_cobranza = cc.id 
        AND pe.activo = true 
        AND pe.id_metodos_pago = 1
    ) AS pagos_efectivo,
    v_total AS total_count
  FROM cuentas_cobranza cc
  LEFT JOIN ofertas o ON cc.id_oferta = o.id
  LEFT JOIN propiedades prop ON o.id_propiedad = prop.id
  LEFT JOIN edificios_modelos em ON prop.id_edificio_modelo = em.id
  LEFT JOIN edificios edif ON em.id_edificio = edif.id
  LEFT JOIN modelos m ON em.id_modelo = m.id
  LEFT JOIN proyectos proy ON COALESCE(edif.id_proyecto, (SELECT pss.id_proyecto FROM productos_servicios pss WHERE pss.id = o.id_producto)) = proy.id
  LEFT JOIN estatus_disponibilidad ed ON prop.id_estatus_disponibilidad = ed.id
  LEFT JOIN productos_servicios ps ON o.id_producto = ps.id
  WHERE cc.activo = p_activo
    AND (p_id_cuenta IS NULL OR cc.id::TEXT ILIKE '%' || p_id_cuenta || '%')
    AND (p_clabe IS NULL OR cc.clabe_stp ILIKE '%' || p_clabe || '%')
    AND (p_no_propiedad IS NULL OR prop.numero ILIKE '%' || p_no_propiedad || '%')
    AND (p_modelo IS NULL OR m.nombre ILIKE '%' || p_modelo || '%')
    AND (p_proyecto IS NULL OR proy.nombre ILIKE '%' || p_proyecto || '%')
    AND (p_producto IS NULL OR ps.nombre ILIKE '%' || p_producto || '%')
    AND (p_estatus_ids IS NULL OR prop.id_estatus_disponibilidad = ANY(p_estatus_ids))
    AND (p_tipos IS NULL OR 
      CASE 
        WHEN o.id_propiedad IS NOT NULL THEN 'Propiedad'
        WHEN o.id_producto IS NOT NULL THEN 'Producto'
        ELSE 'Servicio'
      END = ANY(p_tipos))
    AND (p_proyecto_ids IS NULL OR COALESCE(edif.id_proyecto, ps.id_proyecto) = ANY(p_proyecto_ids))
    AND (p_dueno_entity_ids IS NULL OR prop.id_persona_dueno = ANY(p_dueno_entity_ids))
  ORDER BY cc.id DESC
  LIMIT p_per_page
  OFFSET v_offset;
END;
$$;