-- Update Report 2 (Productos) to include id_dueno filter
UPDATE reportes 
SET query_sql = '
  SELECT 
    pr.nombre AS proyecto,
    pe_dueno.nombre_legal AS dueno,
    cp.nombre AS categoria,
    ps.nombre AS producto,
    string_agg(DISTINCT comprador.nombre_legal, '' / '') AS compradores,
    cc.precio_final,
    COALESCE((
      SELECT SUM(aplp.monto)
      FROM aplicaciones_pago aplp
      JOIN acuerdos_pago ap ON aplp.id_acuerdo_pago = ap.id
      WHERE ap.id_cuenta_cobranza = cc.id 
        AND ap.activo = true
        AND aplp.activo = true
    ), 0) AS pagado,
    cc.precio_final - COALESCE((
      SELECT SUM(aplp.monto)
      FROM aplicaciones_pago aplp
      JOIN acuerdos_pago ap ON aplp.id_acuerdo_pago = ap.id
      WHERE ap.id_cuenta_cobranza = cc.id 
        AND ap.activo = true
        AND aplp.activo = true
    ), 0) AS restante
  FROM cuentas_cobranza cc
  JOIN ofertas o ON cc.id_oferta = o.id
  JOIN productos_servicios ps ON o.id_producto = ps.id
  JOIN categorias_producto cp ON ps.id_categoria = cp.id
  LEFT JOIN proyectos pr ON ps.id_proyecto = pr.id
  LEFT JOIN entidades_relacionadas er_dueno ON ps.id_entidad_relacionada_dueno = er_dueno.id
  LEFT JOIN personas pe_dueno ON er_dueno.id_persona = pe_dueno.id
  LEFT JOIN compradores comp ON comp.id_cuenta_cobranza = cc.id AND comp.activo = true
  LEFT JOIN personas comprador ON comp.id_persona = comprador.id
  WHERE cc.activo = true
    AND cc.id_tipo_cancelacion IS NULL
    AND o.id_producto IS NOT NULL
    {{AND pr.id = :id_proyecto}}
    {{AND cp.id = :id_categoria}}
    {{AND er_dueno.id_persona = :id_dueno}}
  GROUP BY cc.id, pr.nombre, pe_dueno.nombre_legal, cp.nombre, ps.nombre, cc.precio_final
  ORDER BY pr.nombre, dueno, cp.nombre, ps.nombre
',
filtros_configuracion = '[
  {"nombre": "id_proyecto", "label": "Proyecto", "tipo": "select", "tabla": "proyectos", "campo_valor": "id", "campo_label": "nombre", "requerido": false},
  {"nombre": "id_dueno", "label": "Dueño vendedor", "tipo": "select", "depende_de": "id_proyecto", "query_opciones": "SELECT DISTINCT pe.id, pe.nombre_legal FROM productos_servicios ps JOIN entidades_relacionadas er ON ps.id_entidad_relacionada_dueno = er.id JOIN personas pe ON er.id_persona = pe.id WHERE ps.id_proyecto = :id_proyecto AND ps.activo = true AND er.activo = true ORDER BY pe.nombre_legal", "requerido": false},
  {"nombre": "id_categoria", "label": "Categoría", "tipo": "select", "tabla": "categorias_producto", "campo_valor": "id", "campo_label": "nombre", "requerido": false}
]'::jsonb
WHERE id = 2;

-- Update Report 3 (Unificado) to include id_dueno filter in the productos section too
UPDATE reportes 
SET query_sql = '-- PROPIEDADES
SELECT 
  pr.nombre as proyecto,
  pe.nombre_legal as dueno,
  STRING_AGG(DISTINCT comp_persona.nombre_legal, '', '') as compradores,
  p.numero_propiedad as numero_departamento,
  ''CC-'' || LPAD(cc.id::text, 6, ''0'') as id_cuenta_cobranza,
  ''Propiedad'' as tipo,
  NULL as categoria,
  NULL as producto,
  cc.precio_final,
  COALESCE(SUM(CASE WHEN cp.nombre IN (''Apartado'', ''Enganche'', ''Parcialidad'') THEN ap.monto ELSE 0 END), 0) as monto_durante_obra,
  COALESCE(SUM(CASE WHEN cp.nombre = ''Pago a contra entrega'' THEN ap.monto ELSE 0 END), 0) as monto_a_la_entrega,
  COALESCE(SUM(CASE WHEN cp.nombre IN (''Apartado'', ''Enganche'', ''Parcialidad'') AND ap.pago_completado = true THEN ap.monto ELSE 0 END), 0) as pagado_durante_obra,
  COALESCE(SUM(CASE WHEN cp.nombre = ''Pago a contra entrega'' AND ap.pago_completado = true THEN ap.monto ELSE 0 END), 0) as pagado_a_la_entrega,
  COALESCE(SUM(CASE WHEN cp.nombre IN (''Apartado'', ''Enganche'', ''Parcialidad'') AND (ap.pago_completado = false OR ap.pago_completado IS NULL) THEN ap.monto ELSE 0 END), 0) as restante_durante_obra,
  COALESCE(SUM(CASE WHEN cp.nombre = ''Pago a contra entrega'' AND (ap.pago_completado = false OR ap.pago_completado IS NULL) THEN ap.monto ELSE 0 END), 0) as restante_a_la_entrega
FROM cuentas_cobranza cc
JOIN ofertas o ON cc.id_oferta = o.id
JOIN propiedades p ON o.id_propiedad = p.id
JOIN edificios_modelos em ON p.id_edificio_modelo = em.id
JOIN edificios e ON em.id_edificio = e.id
JOIN proyectos pr ON e.id_proyecto = pr.id
JOIN entidades_relacionadas er ON p.id_entidad_relacionada_dueno = er.id
JOIN personas pe ON er.id_persona = pe.id
LEFT JOIN compradores comp ON comp.id_cuenta_cobranza = cc.id AND comp.activo = true
LEFT JOIN personas comp_persona ON comp.id_persona = comp_persona.id
LEFT JOIN acuerdos_pago ap ON ap.id_cuenta_cobranza = cc.id AND ap.activo = true
LEFT JOIN conceptos_pago cp ON ap.id_concepto = cp.id
WHERE cc.activo = true
  AND cc.id_tipo_cancelacion IS NULL
  AND o.id_producto IS NULL
  {{AND pr.id = :id_proyecto}}
  {{AND er.id_persona = :id_dueno}}
  {{AND '':tipo'' <> ''Producto''}}
GROUP BY pr.nombre, pe.nombre_legal, p.numero_propiedad, cc.id, cc.precio_final

UNION ALL

-- PRODUCTOS
SELECT 
  pr.nombre as proyecto,
  pe_vendedor.nombre_legal as dueno,
  STRING_AGG(DISTINCT comp_persona.nombre_legal, '', '') as compradores,
  NULL as numero_departamento,
  ''CCP-'' || LPAD(cc.id::text, 6, ''0'') as id_cuenta_cobranza,
  ''Producto'' as tipo,
  cat.nombre as categoria,
  ps.nombre as producto,
  cc.precio_final,
  COALESCE(SUM(CASE WHEN cp.nombre IN (''Apartado'', ''Enganche'', ''Parcialidad'') THEN ap.monto ELSE 0 END), 0) as monto_durante_obra,
  COALESCE(SUM(CASE WHEN cp.nombre = ''Pago a contra entrega'' THEN ap.monto ELSE 0 END), 0) as monto_a_la_entrega,
  COALESCE(SUM(CASE WHEN cp.nombre IN (''Apartado'', ''Enganche'', ''Parcialidad'') AND ap.pago_completado = true THEN ap.monto ELSE 0 END), 0) as pagado_durante_obra,
  COALESCE(SUM(CASE WHEN cp.nombre = ''Pago a contra entrega'' AND ap.pago_completado = true THEN ap.monto ELSE 0 END), 0) as pagado_a_la_entrega,
  COALESCE(SUM(CASE WHEN cp.nombre IN (''Apartado'', ''Enganche'', ''Parcialidad'') AND (ap.pago_completado = false OR ap.pago_completado IS NULL) THEN ap.monto ELSE 0 END), 0) as restante_durante_obra,
  COALESCE(SUM(CASE WHEN cp.nombre = ''Pago a contra entrega'' AND (ap.pago_completado = false OR ap.pago_completado IS NULL) THEN ap.monto ELSE 0 END), 0) as restante_a_la_entrega
FROM cuentas_cobranza cc
JOIN ofertas o ON cc.id_oferta = o.id
JOIN productos_servicios ps ON o.id_producto = ps.id
JOIN proyectos pr ON ps.id_proyecto = pr.id
LEFT JOIN categorias_producto cat ON ps.id_categoria = cat.id
LEFT JOIN entidades_relacionadas er_vendedor ON ps.id_entidad_relacionada_dueno = er_vendedor.id
LEFT JOIN personas pe_vendedor ON er_vendedor.id_persona = pe_vendedor.id
LEFT JOIN compradores comp ON comp.id_cuenta_cobranza = cc.id AND comp.activo = true
LEFT JOIN personas comp_persona ON comp.id_persona = comp_persona.id
LEFT JOIN acuerdos_pago ap ON ap.id_cuenta_cobranza = cc.id AND ap.activo = true
LEFT JOIN conceptos_pago cp ON ap.id_concepto = cp.id
WHERE cc.activo = true
  AND cc.id_tipo_cancelacion IS NULL
  AND o.id_producto IS NOT NULL
  {{AND pr.id = :id_proyecto}}
  {{AND cat.id = :id_categoria}}
  {{AND er_vendedor.id_persona = :id_dueno}}
  {{AND '':tipo'' <> ''Propiedad''}}
GROUP BY pr.nombre, pe_vendedor.nombre_legal, ps.nombre, cat.nombre, cc.id, cc.precio_final

ORDER BY proyecto, dueno, compradores'
WHERE id = 3;