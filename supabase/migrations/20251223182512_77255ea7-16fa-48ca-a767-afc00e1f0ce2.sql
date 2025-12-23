-- Insert new report "Completamente liquidados" (copying structure from report 6)
INSERT INTO reportes (nombre, descripcion, query_sql, nombre_archivo, activo)
VALUES (
  'Completamente liquidados',
  'Propiedades vendidas donde el monto pagado es igual o mayor al monto total a pagar',
  'SELECT
    pr.nombre AS proyecto,
    COALESCE(dueno.nombre_legal, ''Sin dueño'') AS dueno,
    COALESCE((
      SELECT string_agg(p_comp.nombre_legal, '','' ORDER BY p_comp.nombre_legal)
      FROM compradores c
      JOIN personas p_comp ON c.id_persona = p_comp.id
      WHERE c.id_cuenta_cobranza = cc.id AND c.activo = true
    ), ''Sin comprador'') AS compradores,
    p.numero_propiedad AS numero_departamento,
    ''CC-'' || LPAD(cc.id::text, 6, ''0'') AS numero_cuenta,
    cc.fecha_compra AS fecha_compra,
    cc.precio_final AS monto_total_a_pagar,
    COALESCE((
      SELECT SUM(aplp.monto)
      FROM aplicaciones_pago aplp
      JOIN acuerdos_pago ap ON aplp.id_acuerdo_pago = ap.id
      WHERE ap.id_cuenta_cobranza = cc.id
        AND ap.activo = true
        AND aplp.activo = true
    ), 0) AS monto_total_pagado
  FROM cuentas_cobranza cc
  JOIN ofertas o ON cc.id_oferta = o.id
  JOIN propiedades p ON o.id_propiedad = p.id
  JOIN edificios_modelos em ON p.id_edificio_modelo = em.id
  JOIN edificios e ON em.id_edificio = e.id
  JOIN proyectos pr ON e.id_proyecto = pr.id
  LEFT JOIN entidades_relacionadas er ON p.id_entidad_relacionada_dueno = er.id
  LEFT JOIN personas dueno ON er.id_persona = dueno.id
  WHERE cc.activo = true
    AND cc.id_tipo_cancelacion IS NULL
    AND o.id_propiedad IS NOT NULL
    AND o.id_producto IS NULL
    AND p.id_estatus_disponibilidad = 5
    AND cc.precio_final <= COALESCE((
      SELECT SUM(aplp.monto)
      FROM aplicaciones_pago aplp
      JOIN acuerdos_pago ap ON aplp.id_acuerdo_pago = ap.id
      WHERE ap.id_cuenta_cobranza = cc.id
        AND ap.activo = true
        AND aplp.activo = true
    ), 0)
  ORDER BY pr.nombre, p.numero_propiedad',
  'completamente_liquidados',
  true
);