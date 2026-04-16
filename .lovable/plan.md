
## Diagnóstico

**Datos en BD para cuenta 101, acuerdo 5033 (Parcialidad #33, orden 35):**
- `monto` requerido: **$25,009.42**
- Aplicaciones activas (`es_multa=false`): solo **$4,309.42** (id_aplicacion 46207, pago 21374)
- Aplicación de multa (`es_multa=true`): $20,700 (id 46206) — **NO debe contar** para completar la parcialidad
- `pago_completado` = **`true`** ❌ (incorrecto)

**Causa raíz:** algún flujo (probablemente n8n al aplicar el pago STP 21374) marcó `pago_completado = true` basándose en el monto bruto del pago ($25,009.42) sin descontar la porción aplicada a multas. Por eso la UI muestra "Pagado" cuando en realidad faltan **$20,700**.

**Alcance:** una consulta global detectó **8 acuerdos** en toda la BD con la misma inconsistencia (`pago_completado=true` pero `SUM(aplicaciones no-multa) < monto`). 1 en cuenta 101, 7 en otras cuentas.

## Plan (3 partes)

### 1. Fix de datos (migración SQL — corrección puntual + global)
Corregir todos los acuerdos donde el flag está mal:
```sql
UPDATE acuerdos_pago ap
SET pago_completado = false
WHERE ap.activo = true
  AND ap.pago_completado = true
  AND ap.monto - 0.01 > (
    SELECT COALESCE(SUM(apl.monto), 0)
    FROM aplicaciones_pago apl
    WHERE apl.id_acuerdo_pago = ap.id
      AND apl.activo = true
      AND apl.es_multa = false
  );
```
Esto reseteará el acuerdo 5033 (y los otros 7) a su estado real "Parcial".

### 2. Endurecer la UI — fuente de verdad derivada
En `src/pages/admin/DetalleCuentaCobranza.tsx` (línea ~4240), el badge confía ciegamente en `acuerdo.pago_completado`. Derivar el estado desde la suma real de aplicaciones no-multa para que la UI sea autocorrectiva ante futuras inconsistencias:
```tsx
// Antes:
{acuerdo.pago_completado ? "Pagado" : totalAplicado > 0 ? "Parcial" : "Pendiente"}

// Después:
const estaPagado = totalAplicado >= acuerdo.monto - 0.01;
{estaPagado ? "Pagado" : totalAplicado > 0 ? "Parcial" : "Pendiente"}
```
(`totalAplicado` ya se calcula excluyendo multas en línea 4117-4119.)

Aplicar el mismo patrón al "Total Pagado" del header de la cuenta si depende del flag.

### 3. Crear RPC `recalcular_pago_completado_acuerdos(p_id_cuenta_cobranza int DEFAULT NULL)`
RPC idempotente que sincroniza `pago_completado` desde la suma real de aplicaciones no-multa, llamable:
- desde n8n al final del workflow de aplicación de pagos (reemplaza la lógica frágil actual)
- manualmente por cuenta o globalmente para auditorías futuras

Misma filosofía que `regenerar_clabes_faltantes()`: una sola llamada SQL, sin loops.

## Resultado esperado
- La parcialidad #33 de la cuenta 101 mostrará: badge **"Parcial"**, "Pagado: $4,309.42 de $25,009.42" con su ícono de advertencia (que ya está presente).
- La UI nunca más mostrará "Pagado" si las aplicaciones reales no cubren el monto.
- n8n podrá invocar el RPC para mantener el flag sincronizado en cargas futuras.

## Detalles técnicos
- Migración: 1 UPDATE masivo + 1 CREATE FUNCTION
- Frontend: ~3 líneas en `DetalleCuentaCobranza.tsx`
- Sin cambios destructivos; las aplicaciones reales (`aplicaciones_pago`) ya son correctas, solo el flag derivado estaba mal
