

# Plan: Corregir Estatus de Propiedades con Fórmula Correcta

## Problema Identificado

La migración anterior usó una fórmula incorrecta para calcular el saldo restante:

| Aspecto | Migración Anterior (Incorrecta) | Fórmula Correcta (RPC) |
|---------|--------------------------------|------------------------|
| Cálculo | `SUM(acuerdos_pago) - SUM(aplicaciones_pago)` | `precio_final - SUM(pagos)` |
| Resultado | Incluía discrepancias entre acuerdos y aplicaciones | Refleja el balance real de pagos |

## Propiedades a Corregir

### Caso 1: De "Vendido" (5) a "Pagada completamente" (9)
**18 propiedades** con restante <= 0:

| Proyecto | Propiedades |
|----------|-------------|
| Margot | 602, 603, 701, 808, 816, 819, 1013, 1302, 1311, 1316, 1407, 1414, 1415, 1416, 1420, 1510, 1516, 1612 |

**Incluye las mencionadas:** 603, 1416, 1420

### Caso 2: De "Pagada completamente" (9) a "Vendido" (5)  
**8 propiedades** con restante > 0 (centavos de diferencia):

| Proyecto | Propiedades | Restante |
|----------|-------------|----------|
| Margot | 501, 519, 804, 1008, 1009, 1117, 1304, 1710 | $0.02 - $0.17 |

Nota: Estas tienen diferencias de centavos que son discrepancias de redondeo, técnicamente siguen sin estar completamente pagadas.

## SQL a Ejecutar

### Paso 1: Corrección 5 → 9 (18 propiedades)

```sql
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
```

### Paso 2: Corrección 9 → 5 (8 propiedades con centavos)

```sql
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
```

## Rollback

### IDs para Caso 1 (5 → 9):
```sql
-- Propiedades que cambiarán de 5 a 9:
-- 5044, 4982, 4994, 4999, 5013, 5027, 5030, 5032, 5151, 5060, 5072, 5086, 4914, 4915, 4931, 4977, 5011, 5018
UPDATE propiedades SET id_estatus_disponibilidad = 5
WHERE id IN (5044, 4982, 4994, 4999, 5013, 5027, 5030, 5032, 5151, 5060, 5072, 5086, 4914, 4915, 4931, 4977, 5011, 5018);
```

### IDs para Caso 2 (9 → 5):
```sql
-- Propiedades que cambiarán de 9 a 5:
-- 5034, 5037, 4945, 4984, 5114, 4895, 4912, 4968
UPDATE propiedades SET id_estatus_disponibilidad = 9
WHERE id IN (5034, 5037, 4945, 4984, 5114, 4895, 4912, 4968);
```

## Resultado Esperado

Después de aplicar:
- **18 propiedades** pasarán de "Vendido" a "Pagada completamente" (incluyendo 603, 1416, 1420)
- **8 propiedades** con centavos pendientes pasarán de "Pagada completamente" a "Vendido"
- La interfaz mostrará información coherente con los balances reales

