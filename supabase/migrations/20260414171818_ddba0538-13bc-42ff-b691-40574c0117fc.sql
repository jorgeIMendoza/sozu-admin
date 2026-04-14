
CREATE OR REPLACE FUNCTION public.get_relacion_pagos(
  p_proyecto_id  int     DEFAULT NULL,
  p_metodo_pago  text    DEFAULT NULL,
  p_search       text    DEFAULT NULL,
  p_has_cep      boolean DEFAULT NULL,
  p_limit        int     DEFAULT 100,
  p_offset       int     DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_total  bigint;
BEGIN
  -- Count
  SELECT COUNT(*)
  INTO v_total
  FROM pagos p
  LEFT JOIN metodos_pago mp ON p.id_metodos_pago = mp.id
  LEFT JOIN cuentas_cobranza cc ON p.id_cuenta_cobranza = cc.id
  LEFT JOIN ofertas o ON cc.id_oferta = o.id
  LEFT JOIN personas per ON o.id_persona_lead = per.id
  LEFT JOIN propiedades prop ON cc.id_propiedad = prop.id
  LEFT JOIN edificios_modelos em ON prop.id_edificio_modelo = em.id
  LEFT JOIN edificios e ON em.id_edificio = e.id
  LEFT JOIN proyectos proy ON e.id_proyecto = proy.id
  WHERE p.activo = true
    AND (p_proyecto_id IS NULL OR proy.id = p_proyecto_id)
    AND (p_metodo_pago IS NULL OR mp.nombre = p_metodo_pago)
    AND (p_has_cep IS NULL OR (p_has_cep = true AND p.url_cep IS NOT NULL) OR (p_has_cep = false AND p.url_cep IS NULL))
    AND (p_search IS NULL OR
         per.nombre_legal ILIKE '%' || p_search || '%' OR
         cc.clabe_stp ILIKE '%' || p_search || '%' OR
         p.clave_rastreo ILIKE '%' || p_search || '%');

  -- Data
  SELECT jsonb_build_object(
    'total', v_total,
    'pagos', COALESCE(jsonb_agg(row_data ORDER BY fecha_pago DESC, pago_id DESC), '[]'::jsonb)
  )
  INTO v_result
  FROM (
    SELECT
      p.id                          AS pago_id,
      p.monto,
      p.fecha_pago,
      p.clave_rastreo,
      p.url_cep,
      p.url_recibo,
      p.descripcion,
      p.id_cuenta_cobranza,
      mp.nombre                     AS metodo_pago,
      cc.clabe_stp,
      per.nombre_legal              AS cliente,
      prop.numero_propiedad         AS num_propiedad,
      proy.nombre                   AS proyecto,
      proy.id                       AS proyecto_id,
      (p.url_cep IS NOT NULL)       AS tiene_cep,
      COALESCE((
        SELECT SUM(ap.monto)
        FROM aplicaciones_pago ap
        WHERE ap.id_pago = p.id AND ap.activo = true
      ), 0)                         AS monto_aplicado,
      COALESCE((
        SELECT COUNT(*)
        FROM aplicaciones_pago ap
        WHERE ap.id_pago = p.id AND ap.activo = true
      ), 0)                         AS num_aplicaciones,
      jsonb_build_object(
        'pago_id', p.id,
        'monto', p.monto,
        'fecha_pago', p.fecha_pago,
        'clave_rastreo', p.clave_rastreo,
        'url_cep', p.url_cep,
        'url_recibo', p.url_recibo,
        'descripcion', p.descripcion,
        'id_cuenta_cobranza', p.id_cuenta_cobranza,
        'metodo_pago', mp.nombre,
        'clabe_stp', cc.clabe_stp,
        'cliente', per.nombre_legal,
        'num_propiedad', prop.numero_propiedad,
        'proyecto', proy.nombre,
        'proyecto_id', proy.id,
        'tiene_cep', (p.url_cep IS NOT NULL),
        'monto_aplicado', COALESCE((SELECT SUM(ap2.monto) FROM aplicaciones_pago ap2 WHERE ap2.id_pago = p.id AND ap2.activo = true), 0),
        'num_aplicaciones', COALESCE((SELECT COUNT(*) FROM aplicaciones_pago ap3 WHERE ap3.id_pago = p.id AND ap3.activo = true), 0)
      ) AS row_data
    FROM pagos p
    LEFT JOIN metodos_pago mp ON p.id_metodos_pago = mp.id
    LEFT JOIN cuentas_cobranza cc ON p.id_cuenta_cobranza = cc.id
    LEFT JOIN ofertas o ON cc.id_oferta = o.id
    LEFT JOIN personas per ON o.id_persona_lead = per.id
    LEFT JOIN propiedades prop ON cc.id_propiedad = prop.id
    LEFT JOIN edificios_modelos em ON prop.id_edificio_modelo = em.id
    LEFT JOIN edificios e ON em.id_edificio = e.id
    LEFT JOIN proyectos proy ON e.id_proyecto = proy.id
    WHERE p.activo = true
      AND (p_proyecto_id IS NULL OR proy.id = p_proyecto_id)
      AND (p_metodo_pago IS NULL OR mp.nombre = p_metodo_pago)
      AND (p_has_cep IS NULL OR (p_has_cep = true AND p.url_cep IS NOT NULL) OR (p_has_cep = false AND p.url_cep IS NULL))
      AND (p_search IS NULL OR
           per.nombre_legal ILIKE '%' || p_search || '%' OR
           cc.clabe_stp ILIKE '%' || p_search || '%' OR
           p.clave_rastreo ILIKE '%' || p_search || '%')
    ORDER BY p.fecha_pago DESC, p.id DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN v_result;
END;
$$;
