

## Diagnóstico

### Problema 1: Diferencia de ~$10M en Saldo Vencido
La migración anterior añadió correctamente la resta de **pagos parciales** (`aplicaciones_pago`) al cálculo de Vencido, pero **no aplicó la misma lógica a Programado**. Verificación en base de datos:
- Vencido bruto: $127.6M, parciales aplicados: $27M → neto correcto
- Programado bruto mes: $17.1M, parciales en programado: $2.7M → **no se restan**

La solución: aplicar la misma resta de pagos parciales a **Programado** y **Vencido** para consistencia. Programado debe mostrar el saldo pendiente real de los acuerdos del periodo, no el monto bruto original.

### Problema 2: "Por Cobrar" disminuye con periodos más largos
Actualmente "Por Cobrar" se calcula en el **frontend** como `Programado - Cobrado`. Esto es incorrecto porque:
- `Cobrado` proviene de la tabla `pagos` (pagos reales en el periodo)
- `Programado` proviene de `acuerdos_pago` (montos programados en el periodo)
- Son fuentes diferentes: un pago puede aplicarse a un acuerdo de otro periodo

Cuando el periodo es mayor, `Cobrado` puede superar a `Programado`, dando $0. Verificación:
- Por Cobrar neto real (mes actual): **$14.4M** ✓ (mayor que $0)
- Por Cobrar neto real (3 meses): **$17.6M** ✓ (crece correctamente)

La solución: calcular "Por Cobrar" directamente en el **RPC** como la suma del saldo remanente de acuerdos no pagados en el periodo.

---

## Plan de cambios

### Paso 1: Actualizar RPC `get_dashboard_cobranza_kpis`
Migración SQL para:
1. **Programado del periodo**: restar pagos parciales aplicados a cada acuerdo (igual que Vencido)
2. **Nuevo campo `por_cobrar_mes`**: suma de `(monto - parciales)` para acuerdos en el periodo donde `pago_completado = false` (con contraentrega)
3. **Nuevo campo `por_cobrar_mes_sin_ce`**: igual pero excluyendo `id_concepto = 3`
4. Mantener `programado_mes` y `programado_mes_sin_ce` como monto bruto (meta/objetivo) y agregar versiones netas si es necesario

### Paso 2: Actualizar frontend
En `CobranzaDashboard.tsx`:
- Usar `kpis.por_cobrar_mes` y `kpis.por_cobrar_mes_sin_ce` del RPC en lugar del cálculo `Programado - Cobrado`
- Actualizar el tipo `DashboardKPIs` en `useCobranzaDashboard.ts`

### Archivos afectados
- **Migración SQL**: `CREATE OR REPLACE FUNCTION get_dashboard_cobranza_kpis`
- `src/hooks/useCobranzaDashboard.ts` — nuevos campos en la interfaz
- `src/pages/admin/portal-cobranza/CobranzaDashboard.tsx` — usar campos del RPC

