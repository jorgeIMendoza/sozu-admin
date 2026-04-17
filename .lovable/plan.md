
## Plan: Fix apartado_pagado + auto-status Apartado

### 1) Migración SQL (un solo archivo)

**a) Reemplazar `get_cuentas_cobranza_paginadas`** copiando la versión actual íntegra y cambiando SOLO la línea `false AS apartado_pagado` por:
```sql
COALESCE((
  SELECT bool_and(ap2.pago_completado)
  FROM acuerdos_pago ap2
  WHERE ap2.id_cuenta_cobranza = cc.id
    AND ap2.activo = true
    AND ap2.id_concepto IN (1, 2)  -- 1=Apartado, 2=Enganche
), false) AS apartado_pagado
```
Nota: si la cuenta no tiene acuerdos de Apartado/Enganche, devolver `false` (mantiene comportamiento actual seguro). Mantener firma, parámetros, RETURNS TABLE y resto del cuerpo idénticos.

**b) Crear función + trigger `actualizar_estatus_propiedad_apartada`** sobre `acuerdos_pago` AFTER UPDATE OF `pago_completado`:
- Cuando `NEW.id_concepto = 1` y `NEW.pago_completado = true` y `OLD.pago_completado = false`
- Resolver `id_propiedad` vía `cuentas_cobranza → ofertas`
- Si estatus actual ∈ (1, 2): UPDATE a 4 + `clabe_stp_tmp_apartado = NULL` + `monto_apartado_pagando = 0`
- No tocar si estatus ≥ 4 (no retroceder)
- `SECURITY DEFINER`, `search_path = public`

**c) Backfill one-shot** dentro de la misma migración:
```sql
UPDATE propiedades p
SET id_estatus_disponibilidad = 4,
    clabe_stp_tmp_apartado = NULL,
    monto_apartado_pagando = 0
WHERE p.id_estatus_disponibilidad IN (1, 2)
  AND EXISTS (
    SELECT 1 FROM acuerdos_pago ap
    JOIN cuentas_cobranza cc ON cc.id = ap.id_cuenta_cobranza
    JOIN ofertas o ON o.id = cc.id_oferta
    WHERE o.id_propiedad = p.id
      AND cc.activo = true AND ap.activo = true
      AND ap.id_concepto = 1
      AND ap.pago_completado = true
  );
```

### 2) Validación post-migración (en orden)

1. `SELECT id_estatus_disponibilidad FROM propiedades WHERE id = 5202` → debe ser 4.
2. RPC con filtro de cuenta 1747: `apartado_pagado` → debe ser `true`.
3. RPC con filtro de cuenta 1750: `apartado_pagado` → debe ser `true` y `estatus_propiedad` = "Apartado".
4. Conteo de propiedades movidas por backfill (reportar al usuario).
5. Spot-check: una cuenta con apartado/enganche pendiente debe seguir con `apartado_pagado = false`.
6. Si cualquier validación falla → ajustar la función/trigger e iterar.

### 3) Sin cambios en frontend
Los componentes ya leen `apartado_pagado` correctamente. El trigger es independiente del flujo n8n (este sigue funcionando como respaldo).

### Archivos afectados
- Nueva migración SQL (vía herramienta de migración)
- Cero cambios en código TS
