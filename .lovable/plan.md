
Objetivo: dejar de registrar en `avisos_ejecuciones` las corridas del cron que caen dentro de la tolerancia pero que en realidad ya no deben ejecutar nada porque el primer envío exitoso de esa misma ventana ya ocurrió.

Diagnóstico confirmado
- En `supabase/functions/evaluar-triggers-evento/index.ts`, el log de `avisos_ejecuciones` se crea apenas pasa `withinSendWindow(...)`.
- Después, en el bloque de destinatarios manuales, sí existe la validación que detecta envíos exitosos previos en la misma ventana (`getSuccessfulManualRecipients`).
- Cuando esa validación encuentra que ya se envió bien, hoy la función no vuelve a mandar el aviso, pero sí deja una fila en `avisos_ejecuciones` con motivo como:
  `Ya enviado exitosamente en esta ventana; reenvío automático omitido`.
- Eso explica por qué aparece la fila de las 10:49 p. m.: no fue un nuevo envío real, pero sí se creó el registro antes de decidir que ya no había nada que ejecutar.

Qué se va a corregir
1. Diferir la creación del log hasta confirmar que sí habrá trabajo real
- No crear `avisos_ejecuciones` inmediatamente al entrar en ventana.
- Primero resolver si existen destinatarios efectivos por enviar para esa combinación de:
  - aviso
  - trigger
  - offset
  - fecha objetivo
  - origen de ejecución

2. No registrar corridas automáticas ya satisfechas en la misma ventana
- Para origen `cron`, si todos los destinatarios manuales ya tienen envío exitoso previo para esa ventana, la función debe:
  - omitir el envío,
  - no crear fila en `avisos_ejecuciones`,
  - solo dejar traza en `summary.details` / logs internos si hace falta depuración.
- En otras palabras: si no habrá envío ni error ni trabajo pendiente, no debe existir registro visible en la pantalla de Ejecuciones.

3. Mantener registro solo cuando realmente “sí tocaba ejecutar”
Se conservará el log cuando ocurra cualquiera de estos casos:
- hay destinatarios nuevos que sí se van a enviar,
- hubo error de consulta o procesamiento,
- hubo destinatarios evaluados reales aunque el resultado sea parcial o error,
- el disparo sea manual explícito y se quiera auditar ese intento.

4. Conservar el comportamiento actual fuera de ventana
- Las corridas fuera de `withinSendWindow(...)` seguirán sin registrarse, como ya quedó ajustado antes.
- El cambio nuevo cubre el caso restante: “está dentro de ventana, pero ya quedó satisfecha por una corrida previa exitosa”.

Implementación propuesta
- Reestructurar el loop principal en `supabase/functions/evaluar-triggers-evento/index.ts` para separar:
  1. validaciones previas,
  2. determinación de destinatarios efectivos,
  3. creación del log solo cuando sí proceda.
- En el flujo de destinatarios manuales:
  - ejecutar `getSuccessfulManualRecipients(...)` antes de `createExecutionLog(...)` cuando el origen sea `cron`,
  - filtrar destinatarios ya satisfechos,
  - si después del filtro no queda ninguno, hacer `continue` sin crear registro.
- Mantener `createExecutionLog(...)` antes del primer insert real o antes de cualquier caso que sí deba quedar auditado.
- No cambiar la idempotencia de clientes reales ni el soporte de reenvío manual explícito.

Archivo a modificar
- `supabase/functions/evaluar-triggers-evento/index.ts`

Resultado esperado
- Si el cron envía correctamente a las 10:48, la corrida de las 10:49 dentro de la misma tolerancia ya no enviará nada y tampoco aparecerá en `avisos_ejecuciones`.
- La vista de Ejecuciones mostrará solo corridas que realmente ejecutaron algo relevante o que fallaron.
- Dejará de verse “ruido” de intentos automáticos ya satisfechos.

Validación posterior
- Probar un aviso con destinatarios manuales en una hora exacta.
- Verificar que:
  1. la primera corrida automática cree log y envíe,
  2. la siguiente corrida dentro de tolerancia no cree log si ya todo quedó enviado exitosamente,
  3. una corrida fuera de ventana tampoco cree log,
  4. un reenvío manual explícito siga pudiendo registrarse y ejecutarse.
