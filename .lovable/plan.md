

# Implementación: payload configurable de Postmark por aviso

## 1. Migración de base de datos

```sql
ALTER TABLE avisos
  ADD COLUMN IF NOT EXISTS payload_postmark jsonb;

ALTER TABLE avisos_envios_evento
  ADD COLUMN IF NOT EXISTS payload_enviado jsonb;
```

Sin defaults: `null` significa "usar el payload clásico" (compatibilidad con todos los avisos existentes).

## 2. Helper compartido `renderJsonTemplate`

Función recursiva que recorre cualquier estructura JSON y reemplaza `{{var}}` por el valor del contexto.

- **Strings**: `"Hola {{nombre}}"` → `"Hola Margot"`. Variables faltantes → `""`. Logging warning si la variable no existe.
- **Objetos**: recorre cada clave y rendea su valor.
- **Arrays**: rendea cada elemento.
- **Números/booleans/null**: se devuelven tal cual.

Se duplica en `enviar-aviso-bulk/index.ts` y `evaluar-triggers-evento/index.ts` (las edge functions no comparten módulos).

## 3. Cambios en `evaluar-triggers-evento`

- Construir `context` con todas las variables del acuerdo: `nombre`, `email`, `telefono`, `asunto`, `texto` (HTML renderizado), `monto` (formateado MXN), `fecha_pago` (formato largo es-MX), `orden`, `cuenta_id`, `offset`.
- Si `aviso.payload_postmark` existe → `templateModel = renderJsonTemplate(aviso.payload_postmark, context)`.
- Si no existe → `templateModel = { mensaje: { nombre, texto, asunto } }` (comportamiento actual).
- Persistir `payload_enviado = templateModel` en `avisos_envios_evento` al actualizar el estado final.

## 4. Cambios en `enviar-aviso-bulk` (manual / cron)

- Construir `context` por destinatario: `nombre`, `email`, `asunto`, `texto`.
- Mismo fallback: si `aviso.payload_postmark` existe se usa el render dinámico, si no, payload clásico.
- No requiere cambios de schema en `avisos_ejecuciones` (ya existe `detalle_error`); el payload por destinatario no se persiste para evitar inflar la tabla en envíos masivos.

## 5. UI — sección "Payload del template" en `AdministrarAvisos.tsx`

Nueva sección colapsable debajo del selector de template Postmark, visible siempre que el aviso tenga template Postmark asignado.

**Componentes:**
- **Chips de variables disponibles** (click → copia `{{variable}}` al portapapeles + toast). Lista dinámica:
  - Manual / Cron: `nombre`, `email`, `asunto`, `texto`.
  - Evento: añade `monto`, `fecha_pago`, `orden`, `cuenta_id`, `offset`, `telefono`.
- **Textarea con JSON** (font mono, ~10 filas). Default cuando se activa: payload clásico `{"mensaje":{"nombre":"{{nombre}}","texto":"{{texto}}","asunto":"{{asunto}}"}}`.
- **Validación** al guardar: `JSON.parse` con try/catch; si falla, bloquea con toast de error indicando línea aproximada.
- **Botón "Probar render"**: abre un Dialog con el JSON renderizado usando valores de ejemplo (`Margot Pérez`, `$5,000.00`, `25 de abril de 2026`, etc.) para validar visualmente.
- **Toggle "Usar payload personalizado"**: si está apagado, se guarda `payload_postmark = null` (clásico).

## 6. Verificación end-to-end

Tras desplegar:
1. Confirmar columnas creadas con `supabase--read_query`.
2. Buscar un aviso por evento existente o uno con template Postmark asignado, configurar un `payload_postmark` custom (por ejemplo `{"mensaje":{"nombre":"{{nombre}}","texto":"{{texto}}","asunto":"{{asunto}}"},"datos":{"monto":"{{monto}}","fecha":"{{fecha_pago}}"}}`).
3. Localizar un acuerdo activo cuya `fecha_pago` coincida con `hoy + offset` del trigger; si no hay coincidencia, ajustar temporalmente el offset del trigger para forzar el match.
4. Disparar `evaluar-triggers-evento` con `supabase--curl_edge_functions`.
5. Consultar `avisos_envios_evento` ordenado por `created_at desc` y mostrar el `payload_enviado` resultante.

## Archivos a modificar

- `supabase/migrations/<timestamp>_payload_postmark.sql` (nuevo)
- `supabase/functions/evaluar-triggers-evento/index.ts`
- `supabase/functions/enviar-aviso-bulk/index.ts`
- `src/pages/admin/comunicacion/AdministrarAvisos.tsx`

## Notas técnicas

- El helper `renderTemplate` ya existe en `evaluar-triggers-evento`; `renderJsonTemplate` lo reutiliza por dentro para los strings.
- Variables faltantes producen `""` (no `undefined`/`null`) para no romper Postmark.
- Postmark acepta `TemplateModel` con cualquier forma anidada — el match contra el template visual lo hace por el path completo de llaves.
- El payload no se valida contra el template real de Postmark (no hay API para ello sin enviar); el "Probar render" sólo valida la sustitución local.

