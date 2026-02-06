
# Plan: Ajuste automatizado de centavos para propiedades Margot

## Resumen

Se creara una nueva Edge Function `ajustar-centavos-margot` que corregira todas las discrepancias de centavos (< $1) entre el precio final y la suma de acuerdos de pago para las cuentas de propiedades principales del proyecto Margot.

**Total de cuentas a procesar:**
- **~130 cuentas Caso B** (precio_final = Excel, solo ajustar ultimo acuerdo + ultimo pago)
- **50 cuentas Caso C** (precio_final != Excel, actualizar PF + ajustar ultimo acuerdo + ultimo pago)
- **Total: ~180 cuentas de propiedades principales**

Las cuentas de productos (bodegas, estacionamientos, paquetes amueblados, condensadoras) NO se incluyen en este ajuste ya que no forman parte de la comparacion con el Excel. Se pueden corregir en una fase posterior.

---

## Archivos a crear/modificar

### 1. Nuevo archivo: `supabase/functions/ajustar-centavos-margot/index.ts`

Edge Function que contiene:

**a) Mapa de overrides Caso C (50 cuentas):**
Cuentas donde precio_final en BD difiere del Excel y necesita actualizarse:

| cuenta_id | depto | Excel (target) | DB actual |
|-----------|-------|-----------------|-----------|
| 374 | 202 | 2,292,821.44 | 2,292,821.42 |
| 280 | 205 | 2,584,949.00 | 2,584,948.97 |
| 506 | 207 | 1,450,240.00 | 1,450,240.16 |
| 490 | 219 | 3,917,410.25 | 3,917,410.33 |
| 510 | 220 | 1,489,840.00 | 1,489,840.16 |
| 278 | 305 | 2,636,056.74 | 2,636,056.75 |
| 330 | 311 | 2,085,274.51 | 2,085,274.65 |
| 414 | 312 | 3,709,268.13 | 3,709,268.30 |
| 320 | 319 | 3,925,286.75 | 3,925,286.79 |
| 486 | 405 | 2,608,561.52 | 2,608,561.62 |
| 311 | 406 | 2,509,075.86 | 2,509,075.84 |
| 261 | 413 | 3,516,293.33 | 3,516,293.38 |
| 428 | 414 | 2,240,030.64 | 2,240,030.72 |
| 215 | 415 | 2,300,708.67 | 2,300,708.60 |
| 202 | 419 | 3,665,491.33 | 3,665,491.29 |
| 491 | 505 | 2,675,518.67 | 2,675,518.69 |
| 367 | 513 | 3,451,437.99 | 3,451,438.12 |
| 519 | 518 | 2,776,559.65 | 2,776,559.76 |
| 370 | 608 | 2,375,120.93 | 2,375,120.69 |
| 383 | 613 | 3,477,323.71 | 3,477,323.84 |
| 509 | 614 | 2,273,756.99 | 2,273,757.00 |
| 255 | 618 | 2,806,357.82 | 2,806,357.91 |
| 193 | 619 | 3,762,169.98 | 3,762,169.88 |
| 439 | 705 | 2,548,636.60 | 2,548,636.58 |
| 176 | 709 | 2,564,053.21 | 2,564,053.26 |
| 369 | 712 | 3,841,009.12 | 3,841,009.14 |
| 406 | 715 | 2,342,521.48 | 2,342,521.32 |
| 173 | 718 | 2,735,348.41 | 2,735,348.58 |
| 331 | 719 | 3,511,223.64 | 3,511,223.75 |
| 395 | 720 | 1,506,770.00 | 1,506,770.02 |
| 498 | 805 | 2,702,783.20 | 2,702,783.14 |
| 493 | 806 | 2,634,537.67 | 2,634,537.66 |
| 420 | 807 | 1,466,720.00 | 1,466,719.84 |
| 181 | 1013 | 3,465,994.71 | 3,465,994.76 |
| 340 | 1018 | 2,521,326.08 | 2,521,325.93 |
| 225 | 1103 | 2,329,119.73 | 2,329,119.59 |
| 446 | 1105 | 2,695,658.26 | 2,695,658.31 |
| 230 | 1112 | 3,341,664.96 | 3,341,664.94 |
| 248 | 1113 | 3,555,277.02 | 3,555,277.15 |
| 487 | 1114 | 2,562,776.45 | 2,562,776.38 |
| 329 | 1115 | 2,498,840.24 | 2,498,840.16 |
| 229 | 1118 | 2,748,306.88 | 2,748,306.97 |
| 358 | 1205 | 2,581,584.45 | 2,581,584.60 |
| 372 | 1206 | 2,780,564.66 | 2,780,564.70 |
| 323 | 1317 | 3,046,260.57 | 3,046,260.65 |
| 400 | 1416 | 3,080,823.42 | 3,080,823.44 |
| 398 | 1505 | 2,640,106.53 | 2,640,106.44 |
| 206 | 1516 | 3,103,841.73 | 3,103,841.77 |
| 403 | 1608 | 2,851,203.34 | 2,851,203.33 |
| 1 | 1614 | 2,699,048.79 | 2,699,048.77 |

**b) Logica de procesamiento por cada cuenta:**

```text
Para cada cuenta:

1. Determinar target:
   - Si esta en el mapa de overrides Case C: target = valor del Excel
   - Si no: target = precio_final actual (Case B)

2. Si |target - precio_final| > 0.001:
   → UPDATE cuentas_cobranza SET precio_final = target WHERE id = cuenta_id

3. Obtener suma actual de acuerdos activos

4. Calcular diff = target - suma_acuerdos

5. Si |diff| > 0.001:
   a. Obtener ultimo acuerdo activo (ORDER BY orden DESC LIMIT 1)
   b. UPDATE acuerdos_pago SET monto = monto + diff WHERE id = ultimo_acuerdo_id
   c. Obtener ultimo pago activo (ORDER BY fecha_pago DESC, id DESC LIMIT 1)
   d. UPDATE pagos SET monto = monto + diff WHERE id = ultimo_pago_id

6. Recalcular aplicaciones de pago:
   - Eliminar aplicaciones_pago no-multa existentes
   - Redistribuir pagos a acuerdos en orden
   - Actualizar flag pago_completado en cada acuerdo
```

**c) Cuentas Caso B (target = precio_final actual):**

La funcion consultara dinamicamente todas las cuentas de propiedades principales de Margot (ofertas sin id_producto, precio_final > $100K) donde |precio_final - suma_acuerdos| > 0.001 AND < 1. Para estas, el target es el precio_final actual.

**d) Respuesta:** Retorna un JSON con el detalle de cada cuenta procesada (exito/error, valores antes/despues, ajustes realizados).

### 2. Archivo modificado: `supabase/config.toml`

Se agrega la configuracion de la nueva funcion:

```text
[functions.ajustar-centavos-margot]
verify_jwt = false
```

---

## Flujo de ejecucion

1. Se despliega automaticamente la Edge Function al guardar
2. Se invoca la funcion via POST (sin body necesario) 
3. La funcion procesa las ~180 cuentas secuencialmente
4. Retorna un reporte detallado con resultados
5. Se verifica con la pagina ReporteDiscrepancias que ya no existan diferencias de centavos

## Notas tecnicas

- La logica de redistribucion de aplicaciones se incluye directamente en la funcion (replicando `recalcular-aplicaciones`) para evitar llamadas anidadas y timeouts
- Se usa `SUPABASE_SERVICE_ROLE_KEY` para las operaciones de escritura (mismo patron que `recalcular-aplicaciones`)
- El threshold minimo de $0.01 para aplicaciones se mantiene para cumplir con el constraint `chk_apppago_monto_positivo`
- Los montos se redondean a 2 decimales con `Math.round(x * 100) / 100`
- Se procesan las cuentas secuencialmente para evitar race conditions
