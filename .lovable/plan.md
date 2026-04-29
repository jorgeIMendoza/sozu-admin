# Recordatorio mensual de TODOS los adeudos vencidos a la fecha

## Resumen del problema

Hoy el motor de avisos por evento (`evaluar-triggers-evento`) hace:

```sql
WHERE acuerdos_pago.fecha_pago = (hoy − offset)   -- un día EXACTO
```

Es decir: si corre el 30 de abril con offset 0, sólo encuentra acuerdos cuya `fecha_pago` sea **exactamente** 30-abril-2026. No encuentra a los que deben desde enero, febrero, marzo, ni los del 1-29 de abril.

Lo que tú quieres es un **barrido acumulado**: el día N del mes, mandar **un recordatorio por cliente** que liste **todos sus acuerdos** con `fecha_pago ≤ hoy` y `pago_completado = false`. Esto requiere cambios reales (BD + edge function + UI).

---

## Diseño propuesto

### 1. Nueva fuente de trigger (BD)

Añadir un tercer registro en `aviso_triggers_fuentes`:

| id | clave | nombre |
|----|-------|--------|
| 3  | `acuerdos_vencidos_acumulados` | Adeudos acumulados al día de corte |

Semántica: en cada disparo, evalúa **todos** los `acuerdos_pago` con `activo = true`, `pago_completado = false` y `fecha_pago <= fecha_corte`, donde `fecha_corte = hoy_MX − offset` (offset 0 = el mismo día del cron).

### 2. Cambios en `evaluar-triggers-evento`

Ramificar la query según `fuente.clave`:

```ts
if (fuente.clave === 'acuerdos_vencidos_acumulados') {
  q = q.lte('fecha_pago', fechaObjetivo);   // ← acumulado
} else {
  q = q.eq('fecha_pago', fechaObjetivo);    // ← comportamiento actual
}
```

Y luego **agrupar por cliente** (por `personas.email`) antes de enviar, para que cada cliente reciba **un solo correo** con el desglose de sus adeudos, no uno por acuerdo.

Estructura de variables nuevas que se expondrán al template (además de las actuales):

| Placeholder | Significado |
|---|---|
| `{{total_adeudo}}` | Suma de `monto` de todos los acuerdos vencidos del cliente |
| `{{cantidad_acuerdos}}` | Número de mensualidades vencidas |
| `{{fecha_mas_antigua}}` | Fecha del adeudo más viejo (para urgencia) |
| `{{lista_adeudos}}` | Tabla HTML con: fecha, concepto, depto, monto |
| `{{lista_adeudos_texto}}` | Versión plana para WhatsApp |
| `{{nombre}}`, `{{tratamiento}}`, `{{proyecto}}`, `{{departamento}}` | Igual que hoy, tomados del primer acuerdo del cliente |

La idempotencia (`avisos_envios_evento`) usará `claveEntidad = "acumulado:cliente:{persona_id}:fecha:{fecha_corte}"` para evitar duplicados si el cron pasa varias veces ese día.

### 3. Cambios en la UI (`AdministrarAvisos.tsx`)

- El selector de "Fuente" ya carga dinámicamente desde `aviso_triggers_fuentes`, así que la nueva fuente aparece automáticamente sin tocar el dropdown.
- Añadir una nota contextual cuando se elija `acuerdos_vencidos_acumulados`:
  > "Se notificará un correo por cliente con todos sus adeudos cuya fecha de pago sea ≤ (hoy − offset). Usa offset 0 para evaluar al día. Se recomienda un solo offset (no varios)."
- Validar en guardado: si la fuente es acumulada y hay más de un offset, mostrar warning (técnicamente válido pero genera duplicidad de envíos).

### 4. Configuración del aviso para tu caso

Una vez desplegado, tú creas el aviso así:

| Campo | Valor |
|---|---|
| Modo | Automático por evento |
| Fuente | Adeudos acumulados al día de corte |
| Offsets | `[0]` |
| Hora envío | la que prefieras (ej. `09:00`) |
| Cron de disparo del cliente programado | el cron general ya corre cada minuto; el aviso se filtra por `hora_envio` |

**Para que corra "el día 30 de cada mes"**: configurarlo en `cron_expression` del aviso. Aunque hoy `cron_expression` lo usa el motor de cron clásico, vamos a hacer que **también respete el cron en modo evento** como filtro de "días en que está permitido disparar" (si la expresión no matchea hoy, no evalúa). Si `cron_expression` está vacío en modo evento → corre todos los días a `hora_envio` (comportamiento actual). Para tu caso usarías `0 9 30 * *` (día 30 de cada mes a las 09:00).

---

## Flujo final (ejemplo: cron corre 30-abril-2026 09:00)

```text
ejecutar-avisos-cron (09:00 MX)
  └─▶ evaluar-triggers-evento
        ├─ fecha_corte = 2026-04-30 (offset 0)
        ├─ cron_expression del aviso "0 9 30 * *" → matchea hoy ✓
        ├─ query: SELECT ... WHERE fecha_pago <= '2026-04-30'
        │                       AND pago_completado = false
        │                       AND activo = true
        │                       AND id_concepto IN (2,5,4,3)
        ├─ filtra por desarrollos habilitados (Bottura, etc.)
        ├─ agrupa por cliente (persona.email)
        │     Cliente A → 3 acuerdos vencidos (ene, feb, abr) → 1 correo
        │     Cliente B → 1 acuerdo vencido  (mar)            → 1 correo
        └─ envía vía enviar-notificacion → Postmark + WhatsApp
              con {{lista_adeudos}}, {{total_adeudo}}, etc.
```

---

## Lista de cambios concretos (al aprobar el plan)

1. **Migración SQL** (Supabase): `INSERT INTO aviso_triggers_fuentes (clave, nombre, descripcion, activo) VALUES ('acuerdos_vencidos_acumulados', 'Adeudos acumulados al día de corte', '...', true);`
2. **Edge function** `supabase/functions/evaluar-triggers-evento/index.ts`:
   - Branching `eq` vs `lte` según `fuente.clave`.
   - Agrupar resultados por cliente antes del bucle de envío.
   - Calcular `total_adeudo`, `cantidad_acuerdos`, `lista_adeudos` (HTML y texto plano).
   - Cambiar `claveEntidad` para idempotencia por cliente-fecha.
   - Respetar `cron_expression` del aviso como filtro de "día permitido" cuando `modo_trigger = 'evento'`.
3. **UI** `src/pages/admin/comunicacion/AdministrarAvisos.tsx`:
   - Mostrar campo `cron_expression` también en modo evento (hoy sólo aparece en modo cron).
   - Mostrar nota explicativa al seleccionar la nueva fuente.
   - Mostrar lista de placeholders nuevos disponibles en el editor.
4. **Crear el aviso** (lo puedes hacer tú desde la UI ya con todo desplegado, o lo dejo precreado vía SQL si me das nombre/asunto/HTML).

## Pregunta antes de implementar

¿Quieres que **un mismo cliente** reciba **un solo correo agrupando todos sus adeudos** (mi recomendación: menos ruido, más impacto), o **un correo por cada acuerdo vencido** (más volumen, fácil de auditar individualmente)?

Mi default si no respondes será: **un correo por cliente con tabla de adeudos**.
