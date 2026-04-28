## Problema

Para el trigger 56 ("Recordatorio 3 días antes", `hora_envio=09:00`), la ventana de ejecución real es **09:00:00 – 09:02:00 MX** (2 min). El resto del día (los otros ~1438 minutos) el cron lo evalúa pero sale temprano con un `console.log` "fuera de ventana" y un `continue`. Esos logs viven en Supabase sólo unas pocas horas y se pierden.

Resultado: cuando preguntas "¿se ejecutó hoy?" no hay forma confiable de saberlo, porque:

- Los logs de la ventana 09:00–09:02 ya rotaron.
- La tabla `avisos_ejecuciones_log` sólo se crea **después** de pasar la validación de ventana, así que si la ventana pasó pero no había acuerdos que calificaran, no queda ningún rastro.
- La tabla `avisos_envios_evento` está vacía (sólo se llena si efectivamente se envía algo).

## Solución propuesta

Hacer que **cada vez que el trigger entra en su ventana de envío se inserte una fila persistente en `avisos_ejecuciones_log`**, aunque no haya destinatarios o todo se filtre. Así siempre puedes verificar después: "¿corrió hoy a las 09:00? ¿Cuántos evaluados, cuántos enviados, qué motivos?"

### Cambios en `supabase/functions/evaluar-triggers-evento/index.ts`

1. **Mover `ensureExecutionLog` para que se cree justo al entrar en ventana** (antes de cualquier filtro de proyectos/destinatarios). Hoy se crea más adelante, dentro de algunos `continue` y dentro del flujo de envío.

2. **Cuando `withinSendWindow` devuelve `false`**: ya no llamar al log (igual que hoy). Pero cuando devuelve `true`, **crear inmediatamente** el `avisos_ejecuciones_log` con `estado='ejecutado_sin_destinatarios'` por default, y al final actualizarlo con los contadores reales (`evaluados`, `enviados`, `errores`, `motivos`). Así, aunque el flujo termine en 0 envíos, queda el registro.

3. **Agregar columna `motivo_principal` o un campo JSON `metricas`** en `avisos_ejecuciones_log` si no existe (revisar primero su schema). Si ya tiene esos campos, sólo asegurar que se llenen.

4. **Loguear también un `console.log` resumen** en cada entrada en ventana, con formato fácil de buscar: `[trigger 56 IN-WINDOW] evaluados=X, candidatos=Y, enviados=Z, motivos=[...]`.

### Cómo lo verificarás después

```sql
-- ¿Corrió el trigger 56 hoy a su hora?
SELECT id, fecha_ejecucion, estado, evaluados, enviados, errores, motivos
FROM avisos_ejecuciones_log
WHERE id_aviso = 6  -- Recordatorio 3 días antes
  AND fecha_ejecucion::date = current_date
ORDER BY fecha_ejecucion DESC;
```

Si hay fila → corrió. Si no hay fila → el cron no entró a la ventana (y entonces hay que mirar el cron de pg_cron).

### Pasos exactos

1. Consultar el schema de `avisos_ejecuciones_log` para confirmar columnas disponibles.
2. Si falta alguna columna (ej. `metricas jsonb`), crear migración para agregarla.
3. Modificar `evaluar-triggers-evento/index.ts` para:
   - Crear el log de ejecución apenas el trigger entra en ventana.
   - Garantizar `finalizeExecutionLog` siempre al final del bloque del trigger (en `try/finally`).
4. Probar con `?ignore_window=1` para forzar una ejecución y verificar que se cree la fila aunque no haya envíos.

## Resultado

A partir de mañana, podrás consultar en cualquier momento si el trigger 56 corrió a las 09:00 MX, qué evaluó y por qué no envió (si fue el caso), sin depender de los logs efímeros de Edge Functions.