

## Por qué no aparece el log + qué offset usar

### Problema 1 — La pantalla "Ejecuciones" no muestra los triggers por evento

En tu sistema **conviven dos motores de envío** que escriben en tablas distintas:

| Motor | Cuándo se usa | Tabla donde registra |
|---|---|---|
| `enviar-aviso-bulk` | Envíos manuales masivos ("Enviar Avisos") | `avisos_ejecuciones` ← **la que lee la pantalla "Ejecuciones"** |
| `evaluar-triggers-evento` | Recordatorios automáticos por evento (cron) | `avisos_envios_evento` ← **NO se ve en ninguna pantalla** |

Por eso aunque el cron se ejecute correctamente a las 10:19, jamás aparecerá un renglón en la pantalla "Ejecuciones" — el aviso "Recordatorio de pago" usa el motor de eventos, no el masivo.

### Problema 2 — Aun si se viera, hoy no enviaría nada

Tu trigger 6 está configurado con `offsets_dias = [-3]`. La lógica actual es:
`fecha_objetivo = hoy − offset` → hoy (21-abr) − (−3) = **24-abr-2026**

Datos reales en `acuerdos_pago` (activos, no pagados):

```text
18-abr → 1     25-abr → 6     30-abr → 11    07-may → 1
20-abr → 1     28-abr → 2     04-may → 2     08-may → 1
22-abr → 1     ── 24-abr ──   05-may → 78    10-may → 3
                  0 registros                 11-may → 1
```

24-abr tiene **0 acuerdos** → la función corre sin error pero envía 0 correos y no escribe nada en ninguna tabla visible.

### Qué offset deberías poner

Recordando la semántica de la UI: **negativo = días ANTES del vencimiento**. Recomiendo dos cambios:

1. **Múltiples offsets** para cubrir varias ventanas de aviso, no solo una:
   - `[-7, -3, -1]` → recordatorio 7, 3 y 1 día antes del pago.
   - Con esos offsets, mañana 22-abr enviaría a los pagos del 29-abr (no hay), 25-abr (6 acuerdos) y 23-abr (no hay) → **6 envíos reales mañana** y muchos más los días siguientes (30-abr, 5-may).
2. **Validar HOY mismo** con un offset que sí tenga datos:
   - `-1` → mañana 22-abr (1 acuerdo)
   - `-4` → 25-abr (6 acuerdos)
   - `-9` → 30-abr (11 acuerdos)

### Solución propuesta (3 acciones)

#### A. Hacer visibles los envíos por evento en la pantalla "Ejecuciones"
Modificar `src/pages/admin/comunicacion/Ejecuciones.tsx` para que además de leer `avisos_ejecuciones` (envíos masivos) también lea `avisos_envios_evento` agrupado por `(id_aviso, id_trigger, fecha_envio::date, fecha_objetivo)`, y los muestre como filas con:
- **Trigger**: badge `"evento"` (vs el actual `"manual"`)
- **Destinatarios / Enviados / Errores**: contados de los estados `enviado`, `parcial`, `error`
- **Detalle de error**: concatenación de `email_destino + error` para los renglones con `estado='error'` (mismo modal de errores que ya existe)

Así verás cada corrida del cron de las 10:19 con su resultado, igual que ves los envíos masivos.

#### B. Cambiar el offset del trigger 6
Actualizar `avisos_triggers_evento.offsets_dias` del trigger `id=6` de `[-3]` a `[-7, -3, -1]` (o el conjunto que prefieras). Esto se hace desde la pantalla de administración de avisos, o con un UPDATE.

#### C. Validar inmediatamente sin esperar al cron de mañana
Llamar la función con `?ignore_window=1&override_offset=-4` para forzar un envío real a los 6 acuerdos del 25-abr y confirmar que el flujo Postmark funciona end-to-end.

### Preguntas antes de implementar

