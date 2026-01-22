-- Drop and recreate the function with correct table name
DROP FUNCTION IF EXISTS public.get_cuentas_cobranza_paginadas;

CREATE OR REPLACE FUNCTION public.get_cuentas_cobranza_paginadas(
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
  id INTEGER,
  clabe_stp TEXT,
  fecha_compra TIMESTAMPTZ,
  precio_final NUMERIC,
  valor_uma NUMERIC,
  porcentaje_comision_venta NUMERIC,
  activo BOOLEAN,
  id_propiedad INTEGER,
  numero_propiedad TEXT,
  id_proyecto INTEGER,
  nombre_proyecto TEXT,
  nombre_edificio TEXT,
  nombre_modelo TEXT,
  compradores JSONB,
  id_estatus_disponibilidad INTEGER,
  estatus_disponibilidad_nombre TEXT,
  tipo TEXT,
  vendedor TEXT,
  dueno TEXT,
  apartado_pagado BOOLEAN,
  pagos_efectivo JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INTEGER;
  v_total BIGINT;
BEGIN
  v_offset := (p_page - 1) * p_per_page;

  -- Get total count first
  SELECT COUNT(DISTINCT cc.id) INTO v_total
  FROM cuentas_cobranza cc
  LEFT JOIN ofertas o ON cc.id_oferta = o.id
  LEFT JOIN propiedades prop ON o.id_propiedad = prop.id
  LEFT JOIN productos_servicios ps ON o.id_producto = ps.id
  LEFT JOIN edificios_modelos em ON prop.id_edificio_modelo = em.id
  LEFT JOIN edificios edif ON em.id_edificio = edif.id
  LEFT JOIN modelos m ON em.id_modelo = m.id
  LEFT JOIN estatus_disponibilidad ed ON prop.id_estatus_disponibilidad = ed.id
  LEFT JOIN personas pers_dueno ON prop.id_entidad_relacionada_dueno = pers_dueno.id
  WHERE cc.activo = p_activo
    AND (p_id_cuenta IS NULL OR cc.id::TEXT ILIKE '%' || p_id_cuenta || '%')
    AND (p_clabe IS NULL OR cc.clabe_stp ILIKE '%' || p_clabe || '%')
    AND (p_no_propiedad IS NULL OR prop.numero_propiedad ILIKE '%' || p_no_propiedad || '%')
    AND (p_modelo IS NULL OR m.nombre ILIKE '%' || p_modelo || '%')
    AND (p_producto IS NULL OR ps.nombre ILIKE '%' || p_producto || '%')
    AND (p_proyecto IS NULL OR 
         EXISTS (SELECT 1 FROM proyectos pr WHERE pr.id = COALESCE(edif.id_proyecto, ps.id_proyecto) AND pr.nombre ILIKE '%' || p_proyecto || '%'))
    AND (p_estatus_ids IS NULL OR prop.id_estatus_disponibilidad = ANY(p_estatus_ids))
    AND (p_proyecto_ids IS NULL OR COALESCE(edif.id_proyecto, ps.id_proyecto) = ANY(p_proyecto_ids))
    AND (p_dueno_entity_ids IS NULL OR prop.id_entidad_relacionada_dueno = ANY(p_dueno_entity_ids))
    AND (p_tipos IS NULL OR 
         CASE 
           WHEN o.id_propiedad IS NOT NULL THEN 'Propiedad'
           WHEN ps.id IS NOT NULL AND ps.id_categoria = 1 THEN 'Producto'
           ELSE 'Servicio'
         END = ANY(p_tipos));

  -- Return paginated results
  RETURN QUERY
  SELECT 
    cc.id,
    cc.clabe_stp,
    cc.fecha_compra,
    cc.precio_final,
    cc.valor_uma,
    cc.porcentaje_comision_venta,
    cc.activo,
    prop.id AS id_propiedad,
    prop.numero_propiedad AS numero_propiedad,
    COALESCE(edif.id_proyecto, ps.id_proyecto) AS id_proyecto,
    COALESCE(pr.nombre, pr2.nombre) AS nombre_proyecto,
    edif.nombre AS nombre_edificio,
    m.nombre AS nombre_modelo,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', comp.id_persona,
        'nombre_legal', p_comp.nombre_legal,
        'rfc', p_comp.rfc,
        'porcentaje', comp.porcentaje_copropiedad
      ))
      FROM compradores comp
      LEFT JOIN personas p_comp ON comp.id_persona = p_comp.id
      WHERE comp.id_cuenta_cobranza = cc.id AND comp.activo = true),
      '[]'::jsonb
    ) AS compradores,
    prop.id_estatus_disponibilidad,
    ed.nombre AS estatus_disponibilidad_nombre,
    CASE 
      WHEN o.id_propiedad IS NOT NULL THEN 'Propiedad'
      WHEN ps.id IS NOT NULL AND ps.id_categoria = 1 THEN 'Producto'
      ELSE 'Servicio'
    END AS tipo,
    pers_vendedor.nombre_legal AS vendedor,
    pers_dueno.nombre_legal AS dueno,
    COALESCE(
      (SELECT ap.pago_completado 
       FROM acuerdos_pago ap 
       JOIN conceptos_pago cp ON ap.id_concepto = cp.id 
       WHERE ap.id_cuenta_cobranza = cc.id 
         AND cp.nombre = 'Apartado' 
         AND ap.activo = true 
       LIMIT 1),
      EXISTS (SELECT 1 FROM pagos pag WHERE pag.id_cuenta_cobranza = cc.id AND pag.activo = true LIMIT 1)
    ) AS apartado_pagado,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('fecha_pago', pag.fecha_pago, 'monto', pag.monto))
       FROM pagos pag
       WHERE pag.id_cuenta_cobranza = cc.id 
         AND pag.activo = true 
         AND pag.id_metodos_pago = 2),
      '[]'::jsonb
    ) AS pagos_efectivo,
    v_total AS total_count
  FROM cuentas_cobranza cc
  LEFT JOIN ofertas o ON cc.id_oferta = o.id
  LEFT JOIN propiedades prop ON o.id_propiedad = prop.id
  LEFT JOIN productos_servicios ps ON o.id_producto = ps.id
  LEFT JOIN edificios_modelos em ON prop.id_edificio_modelo = em.id
  LEFT JOIN edificios edif ON em.id_edificio = edif.id
  LEFT JOIN modelos m ON em.id_modelo = m.id
  LEFT JOIN proyectos pr ON edif.id_proyecto = pr.id
  LEFT JOIN proyectos pr2 ON ps.id_proyecto = pr2.id
  LEFT JOIN estatus_disponibilidad ed ON prop.id_estatus_disponibilidad = ed.id
  LEFT JOIN personas pers_vendedor ON o.id_persona_lead = pers_vendedor.id
  LEFT JOIN personas pers_dueno ON prop.id_entidad_relacionada_dueno = pers_dueno.id
  WHERE cc.activo = p_activo
    AND (p_id_cuenta IS NULL OR cc.id::TEXT ILIKE '%' || p_id_cuenta || '%')
    AND (p_clabe IS NULL OR cc.clabe_stp ILIKE '%' || p_clabe || '%')
    AND (p_no_propiedad IS NULL OR prop.numero_propiedad ILIKE '%' || p_no_propiedad || '%')
    AND (p_modelo IS NULL OR m.nombre ILIKE '%' || p_modelo || '%')
    AND (p_producto IS NULL OR ps.nombre ILIKE '%' || p_producto || '%')
    AND (p_proyecto IS NULL OR COALESCE(pr.nombre, pr2.nombre) ILIKE '%' || p_proyecto || '%')
    AND (p_estatus_ids IS NULL OR prop.id_estatus_disponibilidad = ANY(p_estatus_ids))
    AND (p_proyecto_ids IS NULL OR COALESCE(edif.id_proyecto, ps.id_proyecto) = ANY(p_proyecto_ids))
    AND (p_dueno_entity_ids IS NULL OR prop.id_entidad_relacionada_dueno = ANY(p_dueno_entity_ids))
    AND (p_tipos IS NULL OR 
         CASE 
           WHEN o.id_propiedad IS NOT NULL THEN 'Propiedad'
           WHEN ps.id IS NOT NULL AND ps.id_categoria = 1 THEN 'Producto'
           ELSE 'Servicio'
         END = ANY(p_tipos))
  ORDER BY cc.id DESC
  LIMIT p_per_page
  OFFSET v_offset;
END;
$$;