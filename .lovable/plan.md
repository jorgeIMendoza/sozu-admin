

# Plan: Corregir Estatus Incorrectos de Propiedades (Con Rollback)

## Resumen
Corregir el estatus de propiedades con inconsistencias entre su estatus actual y su saldo pendiente real, incluyendo scripts de rollback para revertir los cambios si es necesario.

## Casos a Corregir

### Caso 1: Propiedades marcadas "Pagada completamente" con saldo pendiente
| Métrica | Valor |
|---------|-------|
| Estatus actual | 9 (Pagada completamente) |
| Estatus correcto | 5 (Vendido) |
| Condición | restante > $0 |

### Caso 2: Propiedades marcadas "Vendido" pero ya pagadas
| Métrica | Valor |
|---------|-------|
| Estatus actual | 5 (Vendido) |
| Estatus correcto | 9 (Pagada completamente) |
| Condición | restante <= $0 |

## Paso 0: Capturar Estado Actual (Ejecutar ANTES de los cambios)

Ejecutar estas queries para obtener los IDs de las propiedades que serán afectadas:

```sql
-- Guardar IDs de propiedades que cambiarán de 9 a 5
SELECT p.id, pr.nombre as proyecto, p.nombre as propiedad
FROM propiedades p
JOIN proyectos pr ON p.id_proyecto = pr.id
WHERE p.id_estatus_disponibilidad = 9 
AND p.activo = true
AND (
    COALESCE(
        (SELECT SUM(ap.monto) FROM acuerdos_pago ap 
         JOIN cuentas_cobranza cc ON ap.id_cuenta_cobranza = cc.id 
         WHERE cc.id_propiedad = p.id AND ap.activo = true AND cc.activo = true),
        0
    ) - COALESCE(
        (SELECT SUM(apl.monto) FROM aplicaciones_pago apl 
         JOIN acuerdos_pago ap ON apl.id_acuerdo_pago = ap.id 
         JOIN cuentas_cobranza cc ON ap.id_cuenta_cobranza = cc.id 
         WHERE cc.id_propiedad = p.id AND apl.activo = true AND ap.activo = true AND cc.activo = true),
        0
    )
) > 0;
```

```sql
-- Guardar IDs de propiedades que cambiarán de 5 a 9
SELECT p.id, pr.nombre as proyecto, p.nombre as propiedad
FROM propiedades p
JOIN proyectos pr ON p.id_proyecto = pr.id
WHERE p.id_estatus_disponibilidad = 5 
AND p.activo = true
AND (
    COALESCE(
        (SELECT SUM(ap.monto) FROM acuerdos_pago ap 
         JOIN cuentas_cobranza cc ON ap.id_cuenta_cobranza = cc.id 
         WHERE cc.id_propiedad = p.id AND ap.activo = true AND cc.activo = true),
        0
    ) - COALESCE(
        (SELECT SUM(apl.monto) FROM aplicaciones_pago apl 
         JOIN acuerdos_pago ap ON apl.id_acuerdo_pago = ap.id 
         JOIN cuentas_cobranza cc ON ap.id_cuenta_cobranza = cc.id 
         WHERE cc.id_propiedad = p.id AND apl.activo = true AND ap.activo = true AND cc.activo = true),
        0
    )
) <= 0;
```

## Paso 1: Corrección Caso 1 - De "Pagada completamente" a "Vendido"

```sql
UPDATE propiedades p
SET id_estatus_disponibilidad = 5
FROM (
    SELECT 
        p.id,
        COALESCE(
            (SELECT SUM(ap.monto) FROM acuerdos_pago ap 
             JOIN cuentas_cobranza cc ON ap.id_cuenta_cobranza = cc.id 
             WHERE cc.id_propiedad = p.id AND ap.activo = true AND cc.activo = true),
            0
        ) - COALESCE(
            (SELECT SUM(apl.monto) FROM aplicaciones_pago apl 
             JOIN acuerdos_pago ap ON apl.id_acuerdo_pago = ap.id 
             JOIN cuentas_cobranza cc ON ap.id_cuenta_cobranza = cc.id 
             WHERE cc.id_propiedad = p.id AND apl.activo = true AND ap.activo = true AND cc.activo = true),
            0
        ) as restante
    FROM propiedades p
    WHERE p.id_estatus_disponibilidad = 9 
    AND p.activo = true
) calc
WHERE p.id = calc.id
AND calc.restante > 0;
```

## Paso 2: Corrección Caso 2 - De "Vendido" a "Pagada completamente"

```sql
UPDATE propiedades p
SET id_estatus_disponibilidad = 9
FROM (
    SELECT 
        p.id,
        COALESCE(
            (SELECT SUM(ap.monto) FROM acuerdos_pago ap 
             JOIN cuentas_cobranza cc ON ap.id_cuenta_cobranza = cc.id 
             WHERE cc.id_propiedad = p.id AND ap.activo = true AND cc.activo = true),
            0
        ) - COALESCE(
            (SELECT SUM(apl.monto) FROM aplicaciones_pago apl 
             JOIN acuerdos_pago ap ON apl.id_acuerdo_pago = ap.id 
             JOIN cuentas_cobranza cc ON ap.id_cuenta_cobranza = cc.id 
             WHERE cc.id_propiedad = p.id AND apl.activo = true AND ap.activo = true AND cc.activo = true),
            0
        ) as restante
    FROM propiedades p
    WHERE p.id_estatus_disponibilidad = 5 
    AND p.activo = true
) calc
WHERE p.id = calc.id
AND calc.restante <= 0;
```

## Scripts de Rollback

### Rollback Caso 1: Revertir de "Vendido" a "Pagada completamente"
Usar los IDs obtenidos en el Paso 0:

```sql
-- Reemplazar (id1, id2, id3, ...) con los IDs reales del Paso 0
UPDATE propiedades
SET id_estatus_disponibilidad = 9
WHERE id IN (
    -- Pegar aquí los IDs de la primera query del Paso 0
    -- Ejemplo: 'uuid1', 'uuid2', 'uuid3'
);
```

### Rollback Caso 2: Revertir de "Pagada completamente" a "Vendido"
Usar los IDs obtenidos en el Paso 0:

```sql
-- Reemplazar (id1, id2, id3, ...) con los IDs reales del Paso 0
UPDATE propiedades
SET id_estatus_disponibilidad = 5
WHERE id IN (
    -- Pegar aquí los IDs de la segunda query del Paso 0
    -- Ejemplo: 'uuid1', 'uuid2', 'uuid3'
);
```

## Orden de Ejecución

1. **Ejecutar Paso 0** - Guardar los resultados (IDs) en un archivo o documento
2. **Ejecutar Paso 1** - Corregir propiedades 9 → 5
3. **Ejecutar Paso 2** - Corregir propiedades 5 → 9
4. **Verificar** - Revisar que los cambios sean correctos en la interfaz
5. **Si hay problemas** - Usar los scripts de Rollback con los IDs guardados

## Consideraciones

- Los triggers de SAT están deshabilitados, por lo que no se generarán notificaciones automáticas
- Es importante guardar los IDs del Paso 0 antes de ejecutar los cambios
- Los rollbacks restaurarán el estado exacto anterior de cada propiedad afectada

