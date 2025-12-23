-- Reset the sequence to avoid conflict
SELECT setval('reportes_id_seq', (SELECT MAX(id) FROM reportes));

-- Create "Cartera Vencida" report with explicit next ID
INSERT INTO reportes (id, nombre, nombre_archivo, descripcion, prendido, activo, filtros_configuracion, query_sql)
VALUES (
  5,
  'Cartera Vencida',
  'cartera_vencida',
  'Reporte de cuentas con saldo vencido pendiente de cobro',
  true,
  true,
  '[
    {
      "nombre": "id_proyecto",
      "label": "Proyecto",
      "tipo": "select",
      "query_opciones": "SELECT DISTINCT pr.id, pr.nombre FROM proyectos pr INNER JOIN ofertas o ON o.id_proyecto = pr.id INNER JOIN cuentas_cobranza cc ON cc.id_oferta = o.id WHERE pr.activo = true AND cc.activo = true AND cc.id_tipo_cancelacion IS NULL ORDER BY pr.nombre"
    },
    {
      "nombre": "id_dueno",
      "label": "Dueño",
      "tipo": "select",
      "query_opciones": "SELECT DISTINCT pe.id, pe.nombre_legal as nombre FROM personas pe INNER JOIN entidades_relacionadas er ON er.id_persona = pe.id INNER JOIN proyectos pr ON pr.id = er.id_proyecto WHERE er.id_tipo_entidad = 5 AND er.activo = true AND pe.activo = true ORDER BY pe.nombre_legal"
    },
    {
      "nombre": "tipo",
      "label": "Tipo",
      "tipo": "select",
      "opciones_estaticas": [
        {"id": "Propiedad", "nombre": "Propiedad"},
        {"id": "Producto", "nombre": "Producto"}
      ]
    }
  ]'::jsonb,
  'WITH cuentas_con_montos AS (
    SELECT 
      cc.id AS id_cuenta,
      pr.id AS id_proyecto,
      pr.nombre AS proyecto,
      CASE 
        WHEN prop.id IS NOT NULL THEN (
          SELECT pe.nombre_legal 
          FROM entidades_relacionadas er 
          JOIN personas pe ON pe.id = er.id_persona 
          WHERE er.id_proyecto = pr.id 
          AND er.id_tipo_entidad = 5 
          AND er.activo = true 
          LIMIT 1
        )
        ELSE (
          SELECT pe.nombre_legal 
          FROM entidades_relacionadas er 
          JOIN personas pe ON pe.id = er.id_persona 
          WHERE er.id_proyecto = pr.id 
          AND er.id_tipo_entidad = 5 
          AND er.activo = true 
          LIMIT 1
        )
      END AS dueno,
      (
        SELECT pe_dueno.id
        FROM entidades_relacionadas er_dueno 
        JOIN personas pe_dueno ON pe_dueno.id = er_dueno.id_persona 
        WHERE er_dueno.id_proyecto = pr.id 
        AND er_dueno.id_tipo_entidad = 5 
        AND er_dueno.activo = true 
        LIMIT 1
      ) AS id_persona_dueno,
      STRING_AGG(DISTINCT pc.nombre_legal, '', '') AS compradores,
      COALESCE(prop.numero_departamento, '''') AS numero_departamento,
      CASE 
        WHEN cc.id_tipo_cuenta = 1 THEN ''CC-'' || LPAD(cc.id::text, 6, ''0'')
        WHEN cc.id_tipo_cuenta = 2 THEN ''CCM-'' || LPAD(cc.id::text, 6, ''0'')
        WHEN cc.id_tipo_cuenta = 3 THEN ''CCP-'' || LPAD(cc.id::text, 6, ''0'')
        ELSE ''CC-'' || LPAD(cc.id::text, 6, ''0'')
      END AS numero_cuenta,
      CASE 
        WHEN prop.id IS NOT NULL THEN ''Propiedad''
        ELSE ''Producto''
      END AS tipo,
      COALESCE(cp.nombre, ''N/A'') AS categoria,
      COALESCE(ps.nombre, ''N/A'') AS nombre_producto,
      COALESCE(
        (SELECT SUM(ap.monto) FROM acuerdos_pago ap WHERE ap.id_cuenta_cobranza = cc.id AND ap.activo = true AND (ap.fecha_pago IS NULL OR ap.fecha_pago <= CURRENT_DATE)),
        0
      ) AS monto_a_pagar,
      COALESCE(
        (SELECT SUM(aplp.monto) FROM aplicaciones_pago aplp JOIN pagos p ON p.id = aplp.id_pago WHERE aplp.id_acuerdo_pago IN (SELECT id FROM acuerdos_pago WHERE id_cuenta_cobranza = cc.id AND activo = true) AND aplp.activo = true AND p.activo = true),
        0
      ) AS monto_pagado
    FROM cuentas_cobranza cc
    JOIN ofertas o ON o.id = cc.id_oferta
    JOIN proyectos pr ON pr.id = o.id_proyecto
    LEFT JOIN propiedades prop ON prop.id = o.id_propiedad
    LEFT JOIN ofertas_productos op ON op.id_oferta = o.id AND op.activo = true
    LEFT JOIN productos_servicios ps ON ps.id = op.id_producto_servicio
    LEFT JOIN categorias_producto cp ON cp.id = ps.id_categoria_producto
    JOIN personas_cuentas_cobranza pcc ON pcc.id_cuenta_cobranza = cc.id AND pcc.activo = true
    JOIN personas pc ON pc.id = pcc.id_persona
    WHERE cc.activo = true 
      AND cc.id_tipo_cancelacion IS NULL
      {{AND pr.id = :id_proyecto}}
      {{AND EXISTS (SELECT 1 FROM entidades_relacionadas er WHERE er.id_proyecto = pr.id AND er.id_tipo_entidad = 5 AND er.activo = true AND er.id_persona = :id_dueno)}}
    GROUP BY cc.id, pr.id, pr.nombre, prop.id, prop.numero_departamento, cp.nombre, ps.nombre
  )
  SELECT 
    proyecto,
    dueno,
    compradores,
    numero_departamento,
    numero_cuenta,
    tipo,
    categoria,
    nombre_producto,
    monto_a_pagar,
    monto_pagado,
    monto_a_pagar - monto_pagado AS monto_restante
  FROM cuentas_con_montos
  WHERE monto_a_pagar > monto_pagado
    {{AND tipo = :tipo}}
  ORDER BY proyecto, numero_cuenta'
);

-- Update sequence to next value
SELECT setval('reportes_id_seq', 5);

-- Assign permissions to all roles that have report access (roles 2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17)
INSERT INTO roles_reportes (rol_id, reporte_id, activo)
SELECT rol_id, 5, true
FROM (VALUES (2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13),(14),(15),(16),(17)) AS v(rol_id);