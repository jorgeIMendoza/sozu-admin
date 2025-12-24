-- Actualizar la query del reporte mensual de pagos para agregar nombre del dueño y filtro de mes
UPDATE reportes
SET query_sql = '
WITH pagos_propiedades AS (
  SELECT 
    ''propiedad'' AS tipo,
    pr.id AS id_proyecto,
    pr.nombre AS proyecto,
    er_dueno.id_persona AS id_dueno,
    pe_dueno.nombre_legal AS nombre_dueno,
    p.numero_propiedad AS numero_departamento,
    NULL::text AS nombre_producto,
    ''CC-'' || LPAD(cc.id::text, 6, ''0'') AS numero_cuenta,
    cc.id AS id_cuenta_cobranza,
    pago.fecha_pago,
    mp.nombre AS metodo_pago,
    CASE WHEN mp.nombre IN (''STP'', ''STP-manual'') THEN pago.clave_rastreo ELSE NULL END AS clave_rastreo,
    stp.cuenta_beneficiario AS cuenta_clabe,
    cp.nombre AS concepto_pago,
    pago.monto AS monto_pago,
    (SELECT STRING_AGG(pe.nombre_legal, '', '' ORDER BY pe.nombre_legal) 
     FROM compradores c 
     JOIN personas pe ON c.id_persona = pe.id 
     WHERE c.id_cuenta_cobranza = cc.id AND c.activo = true) AS compradores
  FROM pagos pago
  JOIN cuentas_cobranza cc ON pago.id_cuenta_cobranza = cc.id
  JOIN ofertas o ON cc.id_oferta = o.id
  JOIN propiedades p ON o.id_propiedad = p.id
  JOIN edificios_modelos em ON p.id_edificio_modelo = em.id
  JOIN edificios e ON em.id_edificio = e.id
  JOIN proyectos pr ON e.id_proyecto = pr.id
  LEFT JOIN metodos_pago mp ON pago.id_metodos_pago = mp.id
  LEFT JOIN pagos_stp_raw stp ON pago.clave_rastreo = stp.claverastreo
  LEFT JOIN aplicaciones_pago ap ON ap.id_pago = pago.id AND ap.activo = true
  LEFT JOIN acuerdos_pago acp ON ap.id_acuerdo_pago = acp.id
  LEFT JOIN conceptos_pago cp ON acp.id_concepto = cp.id
  LEFT JOIN entidades_relacionadas er_dueno ON p.id_entidad_relacionada_dueno = er_dueno.id
  LEFT JOIN personas pe_dueno ON er_dueno.id_persona = pe_dueno.id
  WHERE pago.activo = true
    AND cc.activo = true
    AND cc.id_tipo_cancelacion IS NULL
    AND o.id_propiedad IS NOT NULL
    AND o.id_producto IS NULL
    {{AND date_trunc(''month'', pago.fecha_pago) = :mes_pago::date}}
),
pagos_productos AS (
  SELECT 
    ''producto'' AS tipo,
    pr.id AS id_proyecto,
    pr.nombre AS proyecto,
    er_dueno.id_persona AS id_dueno,
    pe_dueno.nombre_legal AS nombre_dueno,
    ps.nombre AS numero_departamento,
    ps.nombre AS nombre_producto,
    ''CCP-'' || LPAD(cc.id::text, 6, ''0'') AS numero_cuenta,
    cc.id AS id_cuenta_cobranza,
    pago.fecha_pago,
    mp.nombre AS metodo_pago,
    CASE WHEN mp.nombre IN (''STP'', ''STP-manual'') THEN pago.clave_rastreo ELSE NULL END AS clave_rastreo,
    stp.cuenta_beneficiario AS cuenta_clabe,
    cp.nombre AS concepto_pago,
    pago.monto AS monto_pago,
    (SELECT STRING_AGG(pe.nombre_legal, '', '' ORDER BY pe.nombre_legal) 
     FROM compradores c 
     JOIN personas pe ON c.id_persona = pe.id 
     WHERE c.id_cuenta_cobranza = cc.id AND c.activo = true) AS compradores
  FROM pagos pago
  JOIN cuentas_cobranza cc ON pago.id_cuenta_cobranza = cc.id
  JOIN ofertas o ON cc.id_oferta = o.id
  JOIN productos_servicios ps ON o.id_producto = ps.id
  LEFT JOIN proyectos pr ON ps.id_proyecto = pr.id
  LEFT JOIN metodos_pago mp ON pago.id_metodos_pago = mp.id
  LEFT JOIN pagos_stp_raw stp ON pago.clave_rastreo = stp.claverastreo
  LEFT JOIN aplicaciones_pago ap ON ap.id_pago = pago.id AND ap.activo = true
  LEFT JOIN acuerdos_pago acp ON ap.id_acuerdo_pago = acp.id
  LEFT JOIN conceptos_pago cp ON acp.id_concepto = cp.id
  LEFT JOIN entidades_relacionadas er_dueno ON ps.id_entidad_relacionada_dueno = er_dueno.id
  LEFT JOIN personas pe_dueno ON er_dueno.id_persona = pe_dueno.id
  WHERE pago.activo = true
    AND cc.activo = true
    AND cc.id_tipo_cancelacion IS NULL
    AND o.id_producto IS NOT NULL
    {{AND date_trunc(''month'', pago.fecha_pago) = :mes_pago::date}}
)
SELECT 
  proyecto,
  nombre_dueno,
  numero_departamento,
  tipo,
  nombre_producto,
  numero_cuenta,
  id_cuenta_cobranza,
  fecha_pago,
  metodo_pago,
  clave_rastreo,
  cuenta_clabe,
  concepto_pago,
  monto_pago,
  compradores,
  id_proyecto,
  id_dueno
FROM (
  SELECT * FROM pagos_propiedades
  UNION ALL
  SELECT * FROM pagos_productos
) combined
WHERE 1=1
  {{AND id_proyecto = :id_proyecto}}
  {{AND id_dueno = :id_dueno}}
  {{AND tipo = :tipo}}
ORDER BY fecha_pago DESC, proyecto, numero_cuenta
',
filtros_configuracion = '[
  {
    "nombre": "mes_pago",
    "label": "Mes de Pago",
    "tipo": "month",
    "requerido": false
  },
  {
    "nombre": "id_proyecto",
    "label": "Proyecto",
    "tipo": "select",
    "query_opciones": "SELECT DISTINCT pr.id, pr.nombre FROM proyectos pr WHERE pr.activo = true AND (EXISTS (SELECT 1 FROM propiedades p JOIN edificios_modelos em ON p.id_edificio_modelo = em.id JOIN edificios e ON em.id_edificio = e.id JOIN ofertas o ON o.id_propiedad = p.id JOIN cuentas_cobranza cc ON cc.id_oferta = o.id WHERE e.id_proyecto = pr.id AND cc.activo = true AND p.activo = true) OR EXISTS (SELECT 1 FROM productos_servicios ps JOIN ofertas o ON o.id_producto = ps.id JOIN cuentas_cobranza cc ON cc.id_oferta = o.id WHERE ps.id_proyecto = pr.id AND cc.activo = true AND ps.activo = true)) ORDER BY pr.nombre"
  },
  {
    "nombre": "id_dueno",
    "label": "Dueño/Aportante",
    "tipo": "select",
    "depende_de": "id_proyecto",
    "query_opciones": "SELECT DISTINCT pe.id, pe.nombre_legal AS nombre FROM entidades_relacionadas er JOIN personas pe ON er.id_persona = pe.id WHERE er.activo = true AND er.id_tipo_entidad IN (4, 15) AND er.id_proyecto = :id_proyecto ORDER BY pe.nombre_legal"
  },
  {
    "nombre": "tipo",
    "label": "Tipo",
    "tipo": "select",
    "opciones_estaticas": [
      {"id": "propiedad", "nombre": "Propiedades"},
      {"id": "producto", "nombre": "Productos"}
    ]
  }
]'::jsonb,
fecha_actualizacion = NOW()
WHERE id = 8;