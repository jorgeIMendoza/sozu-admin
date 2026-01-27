-- Paso 1: Corrección 5 → 9 (18 propiedades con restante <= 0)
UPDATE propiedades p
SET id_estatus_disponibilidad = 9
FROM (
    WITH cuenta_activa AS (
        SELECT DISTINCT ON (o.id_propiedad)
          o.id_propiedad,
          cc.id as cuenta_id,
          cc.precio_final
        FROM ofertas o
        JOIN cuentas_cobranza cc ON cc.id_oferta = o.id AND cc.activo = true
        WHERE o.activo = true AND o.id_producto IS NULL
        ORDER BY o.id_propiedad, cc.fecha_creacion DESC
    ),
    pagos_info AS (
        SELECT 
          cc.id as cuenta_id,
          COALESCE(SUM(CASE WHEN pg.activo = true THEN pg.monto ELSE 0 END), 0) as total_pagado
        FROM cuentas_cobranza cc
        LEFT JOIN pagos pg ON pg.id_cuenta_cobranza = cc.id
        WHERE cc.activo = true
        GROUP BY cc.id
    )
    SELECT 
        prop.id,
        (COALESCE(ca.precio_final, 0) - COALESCE(pi.total_pagado, 0)) as restante
    FROM propiedades prop
    LEFT JOIN cuenta_activa ca ON ca.id_propiedad = prop.id
    LEFT JOIN pagos_info pi ON pi.cuenta_id = ca.cuenta_id
    WHERE prop.activo = true
    AND prop.id_estatus_disponibilidad = 5
    AND ca.cuenta_id IS NOT NULL
) calc
WHERE p.id = calc.id
AND calc.restante <= 0;

-- Paso 2: Corrección 9 → 5 (8 propiedades con centavos pendientes)
UPDATE propiedades p
SET id_estatus_disponibilidad = 5
FROM (
    WITH cuenta_activa AS (
        SELECT DISTINCT ON (o.id_propiedad)
          o.id_propiedad,
          cc.id as cuenta_id,
          cc.precio_final
        FROM ofertas o
        JOIN cuentas_cobranza cc ON cc.id_oferta = o.id AND cc.activo = true
        WHERE o.activo = true AND o.id_producto IS NULL
        ORDER BY o.id_propiedad, cc.fecha_creacion DESC
    ),
    pagos_info AS (
        SELECT 
          cc.id as cuenta_id,
          COALESCE(SUM(CASE WHEN pg.activo = true THEN pg.monto ELSE 0 END), 0) as total_pagado
        FROM cuentas_cobranza cc
        LEFT JOIN pagos pg ON pg.id_cuenta_cobranza = cc.id
        WHERE cc.activo = true
        GROUP BY cc.id
    )
    SELECT 
        prop.id,
        (COALESCE(ca.precio_final, 0) - COALESCE(pi.total_pagado, 0)) as restante
    FROM propiedades prop
    LEFT JOIN cuenta_activa ca ON ca.id_propiedad = prop.id
    LEFT JOIN pagos_info pi ON pi.cuenta_id = ca.cuenta_id
    WHERE prop.activo = true
    AND prop.id_estatus_disponibilidad = 9
    AND ca.cuenta_id IS NOT NULL
) calc
WHERE p.id = calc.id
AND calc.restante > 0;