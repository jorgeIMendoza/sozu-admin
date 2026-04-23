
Objetivo: agregar un switch llamado `Personalizado` en la configuración del aviso para controlar cómo se envían los destinatarios configurados (manuales y por rol), de forma que:
- prendido: cada destinatario reciba su propio correo y/o WhatsApp con variables renderizadas para su caso;
- apagado: se conserve el envío consolidado actual, donde sale un solo mensaje a la lista completa.

Qué se va a construir

1. Persistir la nueva preferencia del aviso
- Agregar un campo booleano en `avisos` para guardar el modo `personalizado`, con valor por defecto `false` para no romper el comportamiento actual.
- Leer y guardar ese valor desde la pantalla de `Administrar Avisos`.

2. Añadir el switch “Personalizado” en la UI
- En `src/pages/admin/comunicacion/AdministrarAvisos.tsx`, incorporar un `Switch` con la etiqueta exacta `Personalizado`.
- Ubicarlo junto a la configuración de envío del aviso para que quede claro que afecta el modo de entrega.
- Al editar un aviso existente, cargar el valor guardado.
- Al crear uno nuevo, iniciar apagado para conservar compatibilidad con los avisos actuales.

3. Cambiar la lógica del envío por evento
- En `supabase/functions/evaluar-triggers-evento/index.ts`, usar el nuevo flag del aviso para bifurcar el flujo de destinatarios configurados:
  - `personalizado = false`: mantener el flujo consolidado actual (`manualAccum` + un solo payload con CSV de emails/teléfonos).
  - `personalizado = true`: enviar uno por uno a cada destinatario configurado, reutilizando el patrón individual que hoy ya existe para cliente real.
- En el modo personalizado:
  - generar `asunto`, `mensaje`, `mensajeWA` y `payload_postmark` por destinatario;
  - mandar `email` y/o `telefono` individual, no listas CSV;
  - registrar un renglón por destinatario en `avisos_envios_evento`;
  - mantener la idempotencia y la regla reciente de no duplicar corridas automáticas satisfechas dentro de la tolerancia.

4. Mantener la personalización correcta
- Con `personalizado = true`, la personalización debe seguir basándose en los datos del acuerdo/cuenta que se esté evaluando:
  - `{{nombre}}`, `{{monto}}`, `{{fecha_pago}}`, `{{orden}}`, `{{departamento}}`, `{{producto}}`, `{{proyecto}}`, etc.
- Para destinatarios manuales o por rol, cada envío saldrá separado pero con los valores del acuerdo correspondiente.
- Cuando un mismo aviso aplique a múltiples acuerdos en la corrida, el envío se hará por destinatario y por contexto de acuerdo, en lugar de mezclar todo en un solo mensaje masivo.

5. Conservar el comportamiento actual cuando esté apagado
- Si `Personalizado` está apagado, se mantiene exactamente el patrón que hoy viste en logs:
  - un solo payload;
  - `to` y/o `numero` en CSV;
  - mismo contenido para toda la lista.
- Esto evita cambios inesperados en avisos ya activos.

6. Revisar el envío manual desde la pantalla “Enviar Avisos”
- El envío manual general hoy usa `supabase/functions/enviar-aviso-bulk/index.ts`.
- Extender esa función para respetar también el nuevo flag:
  - apagado: seguir usando lote masivo;
  - prendido: enviar individualmente a cada destinatario con su render por destinatario.
- Así el comportamiento será consistente tanto en avisos manuales como en automáticos.

Archivos a tocar
- `src/pages/admin/comunicacion/AdministrarAvisos.tsx`
- `supabase/functions/evaluar-triggers-evento/index.ts`
- `supabase/functions/enviar-aviso-bulk/index.ts`
- `src/integrations/supabase/types.ts` se actualizará automáticamente después del cambio de base de datos; no se edita manualmente.

Cambio de base de datos
- Crear migración para añadir a `avisos` un campo booleano, por ejemplo:
  - `personalizado boolean not null default false`
- No se requiere nueva tabla.

Diseño técnico
```text
Aviso.personalizado = false
  -> destinatarios configurados
  -> 1 payload consolidado
  -> to/telefono como CSV
  -> mismo contenido para todos

Aviso.personalizado = true
  -> destinatarios configurados
  -> N payloads individuales
  -> un email/telefono por request
  -> contenido renderizado por destinatario/contexto
```

Resultado esperado
- El switch `Personalizado` permitirá elegir entre:
  - envío masivo no personalizado;
  - envío individual personalizado.
- El caso que mostraste del 22 de abril dejará de agrupar correos y WhatsApps cuando el switch esté prendido.
- Los avisos actuales no cambiarán de comportamiento hasta que actives el switch.

Validación posterior
- Crear o editar un aviso de recordatorio de pago con varios correos/teléfonos configurados.
- Probar con `Personalizado` apagado:
  1. debe seguir saliendo un solo payload consolidado.
- Probar con `Personalizado` prendido:
  2. deben salir múltiples requests, uno por destinatario;
  3. cada request debe llevar solo un correo y/o un WhatsApp;
  4. el contenido debe venir renderizado con los placeholders correctos;
  5. la bitácora `avisos_envios_evento` debe registrar un envío por destinatario.
