## Problema

Hoy en modo evento conviven dos campos que se contradicen:

- **Hora de envío** (`triggers.hora_envio`): usada para una ventana horaria del día.
- **Cron de día permitido** (`avisos.cron_expression`): usado como "gate" de día/hora.

En `evaluar-triggers-evento` ambos se aplican en cascada: primero `withinSendWindow(hora_envio)` y luego `cronMatchesDay(cron_expression)`. Eso hace que un cron `10 9 30 * *` con `hora_envio = 10:00` sea ambiguo (la UI dice "el día 30 a las 9:10" pero la ventana de envío sigue siendo 10:00 ± tolerancia).

## Decisión

**Cuando exista `cron_expression` en modo evento, el cron manda y se ignora `hora_envio`.** La hora de disparo la define el cron. `hora_envio` queda como fallback sólo para los avisos por evento que **no** tienen cron (comportamiento clásico de offsets diarios tipo `-5,-3,-1` con hora fija).

## Cambios

### 1. UI — `src/pages/admin/comunicacion/AdministrarAvisos.tsx`

- En el bloque de modo evento, **mover/ocultar el input "Hora de envío"** cuando `cronExpression` esté lleno:
  - Si `cronExpression` está vacío → se muestra "Hora de envío" como hoy.
  - Si `cronExpression` tiene valor → se oculta el input y se muestra una nota: *"La hora la define el Cron de día permitido. Hora de envío deshabilitada."*
- Reordenar para que primero aparezca **Cron** y luego, condicionalmente, **Hora de envío**.
- Ajustar la nota de Cron: *"Si lo dejas vacío, se evalúa todos los días a la hora de envío. Si lo capturas, el cron define día y hora exactos; la hora de envío se ignora."*
- Al guardar, si hay `cronExpression`, seguir mandando `hora_envio` al backend (para no romper el schema), pero derivarlo del cron (extraer `minuto hora` y guardarlo como `HH:MM:00`) para que quede coherente en BD. Si no se puede parsear (cron con listas/rangos en hora) → guardar `hora_envio` como `00:00:00` placeholder.

### 2. Edge function — `supabase/functions/evaluar-triggers-evento/index.ts`

En el loop por trigger, cambiar el orden y la lógica:

```ts
const hasCron = aviso.cron_expression && typeof aviso.cron_expression === 'string';

if (hasCron) {
  // El cron manda: día y hora.
  if (!cronMatchesNow(aviso.cron_expression, mexNow)) {
    addMotivo(metrics, `Cron no aplica ahora (${aviso.cron_expression})`);
    continue;
  }
  // No evaluar withinSendWindow(hora_envio) en este caso.
} else {
  // Sin cron: comportamiento clásico con ventana de hora_envio.
  if (!ignoreWindow && !withinSendWindow(trig.hora_envio, mexNow)) {
    addMotivo(metrics, `Fuera de ventana de envío (${trig.hora_envio})`);
    continue;
  }
}
```

Donde `cronMatchesNow` ya existe en `ejecutar-avisos-cron` (chequea minuto+hora+día). Reutilizar la misma función (copiarla a `evaluar-triggers-evento` para no introducir un import compartido).

Actualmente `cronMatchesDay` sólo valida día/mes/dow ignorando minuto/hora — eso era correcto cuando hora_envio mandaba. Ahora cambiamos a `cronMatchesNow` (incluye minuto/hora) cuando hay cron en modo evento.

### 3. Sin migración de BD

`triggers.hora_envio` se queda como NOT NULL — sólo cambia su semántica (ignorado si hay cron). Los avisos viejos sin cron siguen funcionando idénticos.

## Resultado esperado

- Aviso con cron `10 9 30 * *`: dispara **el día 30 a las 9:10 MX**, sin importar `hora_envio`. La UI ya no muestra "Hora de envío" para evitar confusión.
- Aviso con offsets `-5,-3,-1` y sin cron: sigue disparando a la `hora_envio` configurada todos los días que apliquen.

¿Apruebas?