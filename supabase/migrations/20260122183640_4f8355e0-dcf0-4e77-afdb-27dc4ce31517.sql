-- Fix: Separate acuerdos calculation to prevent multiplication from JOIN with aplicaciones
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
    p_activo BOOLEAN DEFAULT true,
    p_proyecto_ids INTEGER[] DEFAULT NULL,
    p_dueno_entity_ids INTEGER[] DEFAULT NULL
)
RETURNS TABLE (
    id INTEGER,
    clabe_stp TEXT,
    precio_final NUMERIC,
    fecha_compra DATE,
    activo BOOLEAN,
    id_propiedad INTEGER,
    id_producto_servicio INTEGER,
    id_estatus INTEGER,
    estatus_nombre TEXT,
    proyecto_nombre TEXT,
    proyecto_id INTEGER,
    no_propiedad TEXT,
    modelo_nombre TEXT,
    edificio_nombre TEXT,
    producto_nombre TEXT,
    compradores JSONB,
    vendedor_nombre TEXT,
    total_pagado NUMERIC,
    total_acuerdos NUMERIC,
    discrepancia NUMERIC,
    apartado_pagado BOOLEAN,
    pagos_efectivo JSONB,
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
    SELECT COUNT(*) INTO v_total
    FROM cuentas_cobranza cc
    LEFT JOIN propiedades p ON p.id = cc.id_propiedad
    LEFT JOIN edificios_modelos em ON em.id = p.id_edificio_modelo
    LEFT JOIN proyectos proy ON proy.id = em.id_proyecto
    LEFT JOIN modelos m ON m.id = em.id_modelo
    LEFT JOIN edificios e ON e.id = em.id_edificio
    LEFT JOIN productos_servicios ps ON ps.id = cc.id_producto_servicio
    LEFT JOIN estado_disponibilidad ed ON ed.id = cc.id_estatus
    WHERE cc.activo = p_activo
      AND (p_id_cuenta IS NULL OR cc.id::TEXT ILIKE '%' || p_id_cuenta || '%')
      AND (p_proyecto IS NULL OR proy.nombre ILIKE '%' || p_proyecto || '%' OR ps.nombre ILIKE '%' || p_proyecto || '%')
      AND (p_clabe IS NULL OR cc.clabe_stp ILIKE '%' || p_clabe || '%')
      AND (p_no_propiedad IS NULL OR p.numero_propiedad ILIKE '%' || p_no_propiedad || '%')
      AND (p_modelo IS NULL OR m.nombre ILIKE '%' || p_modelo || '%')
      AND (p_producto IS NULL OR ps.nombre ILIKE '%' || p_producto || '%')
      AND (p_estatus_ids IS NULL OR cc.id_estatus = ANY(p_estatus_ids))
      AND (p_tipos IS NULL OR 
           ('Propiedad' = ANY(p_tipos) AND cc.id_propiedad IS NOT NULL) OR
           ('Producto' = ANY(p_tipos) AND cc.id_producto_servicio IS NOT NULL AND ps.id_categoria_producto != 3) OR
           ('Servicio' = ANY(p_tipos) AND cc.id_producto_servicio IS NOT NULL AND ps.id_categoria_producto = 3))
      AND (p_proyecto_ids IS NULL OR proy.id = ANY(p_proyecto_ids))
      AND (p_dueno_entity_ids IS NULL OR EXISTS (
          SELECT 1 FROM duenos_desarrolladoras_proyecto ddp 
          WHERE ddp.id_proyecto = proy.id 
          AND ddp.id_entidad = ANY(p_dueno_entity_ids)
          AND ddp.activo = true
      ));

    RETURN QUERY
    WITH cuenta_pagos AS (
        -- Calculate total_pagado from aplicaciones (excluding multas)
        SELECT 
          acu.id_cuenta_cobranza,
          COALESCE(SUM(CASE WHEN ap.es_multa = false THEN ap.monto ELSE 0 END), 0) as total_pagado,
          bool_or(acu.id_concepto IN (1, 6) AND acu.pago_completado = true) as apartado_pagado_flag
        FROM acuerdos_pago acu
        LEFT JOIN aplicaciones_pago ap ON ap.id_acuerdo_pago = acu.id AND ap.activo = true
        WHERE acu.activo = true
        GROUP BY acu.id_cuenta_cobranza
    ),
    -- SEPARATE CTE: Calculate total_acuerdos WITHOUT join to aplicaciones to avoid multiplication
    cuenta_acuerdos AS (
        SELECT 
          id_cuenta_cobranza,
          COALESCE(SUM(monto), 0) as total_acuerdos_monto,
          COUNT(*) > 0 as tiene_acuerdos
        FROM acuerdos_pago
        WHERE activo = true
        GROUP BY id_cuenta_cobranza
    ),
    compradores_agg AS (
        SELECT 
          c.id_cuenta_cobranza,
          jsonb_agg(jsonb_build_object(
            'id', c.id,
            'id_persona', c.id_persona,
            'porcentaje_participacion', c.porcentaje_participacion,
            'nombre', per.nombre_legal,
            'rfc', per.rfc
          )) as compradores_json
        FROM compradores c
        JOIN personas per ON per.id = c.id_persona
        WHERE c.activo = true
        GROUP BY c.id_cuenta_cobranza
    ),
    pagos_efectivo AS (
        SELECT 
          pa.id_cuenta_cobranza,
          jsonb_agg(jsonb_build_object('fecha_pago', pa.fecha_pago, 'monto', pa.monto)) as pagos_json
        FROM pagos pa
        WHERE pa.activo = true AND pa.id_metodos_pago = 2
        GROUP BY pa.id_cuenta_cobranza
    ),
    vendedores AS (
        SELECT DISTINCT ON (o.id_propiedad)
          o.id_propiedad,
          COALESCE(per.nombre_legal, '') as vendedor_nombre
        FROM ofertas o
        LEFT JOIN personas per ON per.id = o.id_persona_vendedor
        WHERE o.id_propiedad IS NOT NULL
        ORDER BY o.id_propiedad, o.fecha_creacion DESC
    )
    SELECT 
        cc.id,
        cc.clabe_stp,
        cc.precio_final,
        cc.fecha_compra,
        cc.activo,
        cc.id_propiedad,
        cc.id_producto_servicio,
        cc.id_estatus,
        ed.nombre as estatus_nombre,
        COALESCE(proy.nombre, ps.nombre) as proyecto_nombre,
        proy.id as proyecto_id,
        p.numero_propiedad as no_propiedad,
        m.nombre as modelo_nombre,
        e.nombre as edificio_nombre,
        ps.nombre as producto_nombre,
        COALESCE(ca_agg.compradores_json, '[]'::jsonb) as compradores,
        COALESCE(v.vendedor_nombre, '') as vendedor_nombre,
        COALESCE(cp.total_pagado, 0)::NUMERIC as total_pagado,
        COALESCE(cac.total_acuerdos_monto, 0)::NUMERIC as total_acuerdos,
        CASE 
          WHEN COALESCE(cac.tiene_acuerdos, false) 
          THEN ROUND(cc.precio_final - COALESCE(cac.total_acuerdos_monto, 0), 2)
          ELSE 0 
        END::NUMERIC as discrepancia,
        COALESCE(cp.apartado_pagado_flag, false) as apartado_pagado,
        COALESCE(pe.pagos_json, '[]'::jsonb) as pagos_efectivo,
        v_total as total_count
    FROM cuentas_cobranza cc
    LEFT JOIN propiedades p ON p.id = cc.id_propiedad
    LEFT JOIN edificios_modelos em ON em.id = p.id_edificio_modelo
    LEFT JOIN proyectos proy ON proy.id = em.id_proyecto
    LEFT JOIN modelos m ON m.id = em.id_modelo
    LEFT JOIN edificios e ON e.id = em.id_edificio
    LEFT JOIN productos_servicios ps ON ps.id = cc.id_producto_servicio
    LEFT JOIN estado_disponibilidad ed ON ed.id = cc.id_estatus
    LEFT JOIN cuenta_pagos cp ON cp.id_cuenta_cobranza = cc.id
    LEFT JOIN cuenta_acuerdos cac ON cac.id_cuenta_cobranza = cc.id
    LEFT JOIN compradores_agg ca_agg ON ca_agg.id_cuenta_cobranza = cc.id
    LEFT JOIN pagos_efectivo pe ON pe.id_cuenta_cobranza = cc.id
    LEFT JOIN vendedores v ON v.id_propiedad = cc.id_propiedad
    WHERE cc.activo = p_activo
      AND (p_id_cuenta IS NULL OR cc.id::TEXT ILIKE '%' || p_id_cuenta || '%')
      AND (p_proyecto IS NULL OR proy.nombre ILIKE '%' || p_proyecto || '%' OR ps.nombre ILIKE '%' || p_proyecto || '%')
      AND (p_clabe IS NULL OR cc.clabe_stp ILIKE '%' || p_clabe || '%')
      AND (p_no_propiedad IS NULL OR p.numero_propiedad ILIKE '%' || p_no_propiedad || '%')
      AND (p_modelo IS NULL OR m.nombre ILIKE '%' || p_modelo || '%')
      AND (p_compradores IS NULL OR EXISTS (
          SELECT 1 FROM compradores comp
          JOIN personas pers ON pers.id = comp.id_persona
          WHERE comp.id_cuenta_cobranza = cc.id
          AND comp.activo = true
          AND (pers.nombre_legal ILIKE '%' || p_compradores || '%' OR pers.rfc ILIKE '%' || p_compradores || '%')
      ))
      AND (p_producto IS NULL OR ps.nombre ILIKE '%' || p_producto || '%')
      AND (p_estatus_ids IS NULL OR cc.id_estatus = ANY(p_estatus_ids))
      AND (p_tipos IS NULL OR 
           ('Propiedad' = ANY(p_tipos) AND cc.id_propiedad IS NOT NULL) OR
           ('Producto' = ANY(p_tipos) AND cc.id_producto_servicio IS NOT NULL AND ps.id_categoria_producto != 3) OR
           ('Servicio' = ANY(p_tipos) AND cc.id_producto_servicio IS NOT NULL AND ps.id_categoria_producto = 3))
      AND (p_proyecto_ids IS NULL OR proy.id = ANY(p_proyecto_ids))
      AND (p_dueno_entity_ids IS NULL OR EXISTS (
          SELECT 1 FROM duenos_desarrolladoras_proyecto ddp 
          WHERE ddp.id_proyecto = proy.id 
          AND ddp.id_entidad = ANY(p_dueno_entity_ids)
          AND ddp.activo = true
      ))
    ORDER BY cc.id DESC
    LIMIT p_per_page
    OFFSET v_offset;
END;
$$;