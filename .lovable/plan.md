
Objetivo: evitar que el aviso se vuelva a enviar automáticamente dentro de la misma ventana de tolerancia del cron si la primera ejecución ya se envió con éxito, pero conservar la posibilidad de reenviar cuando el disparo sea explícitamente manual.

Diagnóstico confirmado
- `evaluar-triggers-evento` usa `withinSendWindow(..., toleranceMin = 2)`, así que una hora configurada como `22:20` también puede ejecutarse en `22:21` y `22:22` si sigue dentro de la tolerancia.
- Después del cambio reciente, los destinatarios manuales usan una `claveEntidad` con `executionId`:
  `trigger:{id}:offset:{offset}:fecha:{fechaObjetivo}:manual:{email}:exec:{executionId}`
- Eso hace que cada corrida dentro de la misma ventana inserte nuevos registros en `avisos_envios_evento`, por lo que el cron ya no detecta “duplicado” y vuelve a enviar.
- Hoy no existe una protección separada por “ventana de ejecución exitosa” para destinatarios manuales automáticos.

Qué se va a cambiar
1. Separar “corrida automática del cron” de “reenvío manual explícito”
- Mantener la clave con `executionId` solo para casos de reenvío manual explícito.
- Para corridas automáticas del cron, antes de enviar a destinatarios manuales, validar si ya hubo una ejecución exitosa previa del mismo aviso/trigger/offset/fecha objetivo dentro de esa ventana.

2. Agregar una validación previa de éxito ya registrado
- En el bloque del lote manual consolidado, consultar `avisos_envios_evento` buscando registros previos del mismo:
  - `id_aviso`
  - `id_trigger`
  - `fecha_objetivo`
  - destinatario manual
  - estado exitoso (`enviado` o equivalente válido)
- Si ya existe al menos un envío exitoso de esa corrida lógica, omitir el nuevo envío automático aunque todavía siga dentro de la tolerancia.

3. No romper el reenvío manual explícito
- Introducir un indicador claro en la función para distinguir origen:
  - automático/cron
  - manual explícito
- Cuando el origen sea manual explícito, omitir esa validación de bloqueo por ventana y seguir permitiendo claves con `executionId`.

4. Dejar trazabilidad clara en el log
- La corrida debe seguir registrándose en `avisos_ejecuciones`.
- Cuando se omita por esta nueva regla, guardar un motivo legible como:
  - `Ya enviado exitosamente en esta ventana; reenvío automático omitido`
- Así el usuario verá la corrida, pero con explicación de por qué no volvió a salir.

Archivos a modificar
- `supabase/functions/evaluar-triggers-evento/index.ts`
- Si ya existe un disparo manual desde UI o función interna para este flujo, revisar también el punto donde se invoca para enviar un flag/origen explícito.

Implementación propuesta
- Añadir un parámetro/origen de ejecución en `evaluar-triggers-evento` para distinguir automático vs manual.
- Crear una validación helper para detectar si ya hubo envío exitoso previo del lote manual para ese `trigger + offset + fechaObjetivo`.
- Aplicar esa validación solo al bloque de `manualAccum` cuando la corrida sea automática.
- Mantener:
  - la tolerancia de ventana actual,
  - la bitácora en `avisos_ejecuciones`,
  - la idempotencia estable de clientes reales,
  - el `executionId` para reenvíos manuales explícitos.

Resultado esperado
- Si el cron corre a las 10:20 y envía bien, la corrida de las 10:21 ya no volverá a mandar el aviso aunque siga dentro de la tolerancia.
- El sistema seguirá mostrando la segunda corrida en el log, pero marcada como omitida por envío exitoso previo.
- Si el usuario dispara un reenvío manual explícito, sí podrá volver a enviarse.

Validación posterior
- Configurar un aviso con destinatarios manuales y tolerancia activa.
- Verificar:
  1. que la primera corrida automática envíe correctamente,
  2. que la siguiente corrida dentro de la tolerancia no reenvíe,
  3. que el log registre la segunda como omitida con motivo claro,
  4. que un disparo manual explícito sí vuelva a enviar.
