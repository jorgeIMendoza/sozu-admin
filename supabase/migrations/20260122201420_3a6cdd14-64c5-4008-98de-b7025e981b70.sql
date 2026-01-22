-- Drop and recreate the function with correct column references
DROP FUNCTION IF EXISTS get_cuentas_cobranza_paginadas(integer, integer, text, integer[], integer[], text, text, text, text, text, text, integer[], text[], boolean);

CREATE OR REPLACE FUNCTION get_cuentas_cobranza_paginadas(
  p_page integer DEFAULT 1,
  p_per_page integer DEFAULT 50,
  p_id_cuenta text DEFAULT NULL,
  p_proyecto_ids integer[] DEFAULT NULL,
  p_dueno_entity_ids integer[] DEFAULT NULL,
  p_clabe text DEFAULT NULL,
  p_no_propiedad text DEFAULT NULL,
  p_modelo text DEFAULT NULL,
  p_compradores text DEFAULT NULL,
  p_producto text DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_estatus_ids integer[] DEFAULT NULL,
  p_tipos text[] DEFAULT NULL,
  p_activo boolean DEFAULT true
)
RETURNS TABLE (
  id integer,
  clabe_stp text,
  fecha_compra date,
  precio_final numeric,
  id_oferta integer,
  activo boolean,
  id_propiedad integer,
  id_producto integer,
  id_estatus_cuenta integer,
  porcentaje_comision_venta numeric,
  valor_uma numeric,
  razon_cancelacion text,
  numero_propiedad text,
  edificio text,
  modelo text,
  proyecto text,
  id_proyecto integer,
  estatus_cuenta text,
  id_estatus_disponibilidad integer,
  estatus_disponibilidad text,
  id_edificio_modelo integer,
  id_entidad_relacionada_dueno integer,
  dueno text,
  tipo text,
  producto text,
  categoria_producto text,
  compradores jsonb,
  total_pagado numeric,
  total_acuerdos numeric,
  apartado_pagado boolean,
  cash_payments jsonb,
  agente_vendedor text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset integer;
  v_total bigint;
BEGIN
  v_offset := (p_page - 1) * p_per_page;
  
  -- Get total count first
  SELECT COUNT(*)
  INTO v_total
  FROM cuentas_cobranza cc
  LEFT JOIN propiedades prop ON cc.id_propiedad = prop.id
  LEFT JOIN edificios_modelos em ON prop.id_edificio_modelo = em.id
  LEFT JOIN modelos m ON em.id_modelo = m.id
  LEFT JOIN edificios e ON em.id_edificio = e.id
  LEFT JOIN proyectos proy ON e.id_proyecto = proy.id
  LEFT JOIN productos_servicios ps ON cc.id_producto = ps.id
  LEFT JOIN proyectos proy_prod ON ps.id_proyecto = proy_prod.id
  WHERE cc.activo = p_activo
    AND (p_id_cuenta IS NULL OR cc.id::text ILIKE '%' || p_id_cuenta || '%')
    AND (p_proyecto_ids IS NULL OR COALESCE(proy.id, proy_prod.id) = ANY(p_proyecto_ids))
    AND (p_dueno_entity_ids IS NULL OR prop.id_entidad_relacionada_dueno = ANY(p_dueno_entity_ids))
    AND (p_clabe IS NULL OR cc.clabe_stp ILIKE '%' || p_clabe || '%')
    AND (p_no_propiedad IS NULL OR prop.numero ILIKE '%' || p_no_propiedad || '%')
    AND (p_modelo IS NULL OR m.nombre ILIKE '%' || p_modelo || '%')
    AND (p_producto IS NULL OR ps.nombre ILIKE '%' || p_producto || '%')
    AND (p_estatus_ids IS NULL OR cc.id_estatus_cuenta = ANY(p_estatus_ids))
    AND (p_tipos IS NULL OR 
         (cc.id_propiedad IS NOT NULL AND 'Propiedad' = ANY(p_tipos)) OR
         (cc.id_producto IS NOT NULL AND cc.id_propiedad IS NULL AND 'Producto' = ANY(p_tipos)));

  RETURN QUERY
  SELECT 
    cc.id::integer,
    cc.clabe_stp::text,
    cc.fecha_compra::date,
    cc.precio_final::numeric,
    cc.id_oferta::integer,
    cc.activo::boolean,
    cc.id_propiedad::integer,
    cc.id_producto::integer,
    cc.id_estatus_cuenta::integer,
    cc.porcentaje_comision_venta::numeric,
    cc.valor_uma::numeric,
    cc.razon_cancelacion::text,
    prop.numero::text as numero_propiedad,
    e.nombre::text as edificio,
    m.nombre::text as modelo,
    COALESCE(proy.nombre, proy_prod.nombre)::text as proyecto,
    COALESCE(proy.id, proy_prod.id)::integer as id_proyecto,
    ec.nombre::text as estatus_cuenta,
    prop.id_estatus_disponibilidad::integer,
    ed.nombre::text as estatus_disponibilidad,
    prop.id_edificio_modelo::integer,
    prop.id_entidad_relacionada_dueno::integer,
    per.nombre_legal::text as dueno,
    CASE 
      WHEN cc.id_propiedad IS NOT NULL THEN 'Propiedad'
      WHEN cc.id_producto IS NOT NULL THEN 'Producto'
      ELSE 'Servicio'
    END::text as tipo,
    ps.nombre::text as producto,
    cat.nombre::text as categoria_producto,
    -- Compradores as JSON array
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id', comp.id,
        'id_persona', comp.id_persona,
        'porcentaje_participacion', comp.porcentaje_participacion,
        'nombre_legal', pers.nombre_legal,
        'rfc', pers.rfc
      ))
      FROM compradores comp
      JOIN personas pers ON comp.id_persona = pers.id
      WHERE comp.id_cuenta_cobranza = cc.id AND comp.activo = true
    ) as compradores,
    -- Total pagado
    COALESCE((
      SELECT SUM(p.monto) 
      FROM pagos p 
      WHERE p.id_cuenta_cobranza = cc.id AND p.activo = true
    ), 0)::numeric as total_pagado,
    -- Total acuerdos
    COALESCE((
      SELECT SUM(ap.monto) 
      FROM acuerdos_pago ap 
      WHERE ap.id_cuenta_cobranza = cc.id AND ap.activo = true
    ), 0)::numeric as total_acuerdos,
    -- Apartado pagado
    COALESCE(
      (SELECT ap.pago_completado FROM acuerdos_pago ap 
       JOIN conceptos_pago cp ON ap.id_concepto = cp.id
       WHERE ap.id_cuenta_cobranza = cc.id AND cp.nombre = 'Apartado' AND ap.activo = true LIMIT 1),
      EXISTS(SELECT 1 FROM pagos p WHERE p.id_cuenta_cobranza = cc.id AND p.activo = true AND p.monto > 0)
    )::boolean as apartado_pagado,
    -- Cash payments
    (
      SELECT jsonb_agg(jsonb_build_object('fecha_pago', pe.fecha_pago, 'monto', pe.monto))
      FROM pagos pe
      WHERE pe.id_cuenta_cobranza = cc.id AND pe.activo = true AND pe.id_metodos_pago = 2
    ) as cash_payments,
    -- Agente vendedor
    (
      SELECT pers_v.nombre_legal
      FROM ofertas o
      JOIN personas pers_v ON o.id_persona_vendedor = pers_v.id
      WHERE o.id = cc.id_oferta
      LIMIT 1
    )::text as agente_vendedor,
    v_total as total_count
  FROM cuentas_cobranza cc
  LEFT JOIN propiedades prop ON cc.id_propiedad = prop.id
  LEFT JOIN edificios_modelos em ON prop.id_edificio_modelo = em.id
  LEFT JOIN modelos m ON em.id_modelo = m.id
  LEFT JOIN edificios e ON em.id_edificio = e.id
  LEFT JOIN proyectos proy ON e.id_proyecto = proy.id
  LEFT JOIN estatus_disponibilidad ed ON prop.id_estatus_disponibilidad = ed.id
  LEFT JOIN entidades_relacionadas ent ON prop.id_entidad_relacionada_dueno = ent.id
  LEFT JOIN personas per ON ent.id_persona = per.id
  LEFT JOIN productos_servicios ps ON cc.id_producto = ps.id
  LEFT JOIN proyectos proy_prod ON ps.id_proyecto = proy_prod.id
  LEFT JOIN categorias_productos cat ON ps.id_categoria = cat.id
  LEFT JOIN estatus_cuentas ec ON cc.id_estatus_cuenta = ec.id
  WHERE cc.activo = p_activo
    AND (p_id_cuenta IS NULL OR cc.id::text ILIKE '%' || p_id_cuenta || '%')
    AND (p_proyecto_ids IS NULL OR COALESCE(proy.id, proy_prod.id) = ANY(p_proyecto_ids))
    AND (p_dueno_entity_ids IS NULL OR prop.id_entidad_relacionada_dueno = ANY(p_dueno_entity_ids))
    AND (p_clabe IS NULL OR cc.clabe_stp ILIKE '%' || p_clabe || '%')
    AND (p_no_propiedad IS NULL OR prop.numero ILIKE '%' || p_no_propiedad || '%')
    AND (p_modelo IS NULL OR m.nombre ILIKE '%' || p_modelo || '%')
    AND (p_compradores IS NULL OR EXISTS (
      SELECT 1 FROM compradores comp 
      JOIN personas pers ON comp.id_persona = pers.id
      WHERE comp.id_cuenta_cobranza = cc.id AND comp.activo = true
      AND pers.nombre_legal ILIKE '%' || p_compradores || '%'
    ))
    AND (p_producto IS NULL OR ps.nombre ILIKE '%' || p_producto || '%')
    AND (p_vendedor IS NULL OR EXISTS (
      SELECT 1 FROM ofertas o
      JOIN personas pers_v ON o.id_persona_vendedor = pers_v.id
      WHERE o.id = cc.id_oferta
      AND pers_v.nombre_legal ILIKE '%' || p_vendedor || '%'
    ))
    AND (p_estatus_ids IS NULL OR cc.id_estatus_cuenta = ANY(p_estatus_ids))
    AND (p_tipos IS NULL OR 
         (cc.id_propiedad IS NOT NULL AND 'Propiedad' = ANY(p_tipos)) OR
         (cc.id_producto IS NOT NULL AND cc.id_propiedad IS NULL AND 'Producto' = ANY(p_tipos)))
  ORDER BY cc.id DESC
  LIMIT p_per_page
  OFFSET v_offset;
END;
$$;