

## Plan: Two Issues

### Issue 1: Verify Google Calendar Permissions on Email Blur

**What the user wants**: When the "Email del calendario Google" field loses focus in `ConfiguracionCitas.tsx`, automatically verify that the service account (`cuenta-conexiones-drive@sozu-38755.iam.gserviceaccount.com`) has access to that calendar.

**Approach**:
1. Add a new action `"verify-calendar-access"` to the `agendar-capacitacion` Edge Function. This action will:
   - Use Domain-Wide Delegation to impersonate the provided calendar email
   - Attempt a simple Calendar API call (e.g., `calendarList.get` or list events with a 1-result limit)
   - Return `{ success: true, accessible: true/false }` based on whether the call succeeds or returns a 403/404

2. In `ConfiguracionCitas.tsx`:
   - Add an `onBlur` handler to the "Email del calendario Google" input
   - When the field loses focus and contains a valid email, call the Edge Function with `action: "verify-calendar-access"` and the email
   - Show a visual indicator: green checkmark if accessible, red warning if not (with a message like "La cuenta de servicio no tiene permisos en este calendario")
   - Add a loading state while verifying

**Files to modify**:
- `supabase/functions/agendar-capacitacion/index.ts` — add `verify-calendar-access` action handler
- `src/pages/admin/comunicacion/ConfiguracionCitas.tsx` — add onBlur verification logic and UI feedback

---

### Issue 2: Firmantes Disappearing from `cartas_acuerdo.firmantes_config`

**Investigation findings**:
- The DB currently shows `firmantes_config` with 1 entry (image 2 shows "Rodrigo Terveen" configured)
- No DB triggers exist on `cartas_acuerdo` that could clear the field
- The `firmas_digitales.firmantes` field (separate from `firmantes_config`) is intact in the DB
- No constraints or cascading rules affect `firmantes_config`

**Root cause identified**: The `firmantes` state in `CartaAcuerdoDetalle.tsx` is initialized from `firmantes_config` via a `firmantesLoaded` flag (line 93-95). However, there is a subtle race condition:
- When `handleSave()` is called (line 159-170), it saves the **current** `firmantes` state to `firmantes_config`
- The save mutation includes `contenido_html`, `firmantes_config`, and `biometrica` — all three are saved together
- If the user clicks "Guardar" from the **Editor** tab (line 354) without having visited the Firmantes tab first, and `editorHtml` is not null, then the `firmantes` state might still be empty (if the query hasn't completed yet or `firmantesLoaded` hasn't triggered)
- Additionally, when toggling biometrica (line 172-181), it does **not** save firmantes — this is fine
- But the critical issue: `handleSave` on line 169 always sends the current `firmantes` array. If a user navigates to the page, the query loads, and `firmantesLoaded` is set. But if the component re-renders before the query completes (e.g., quick "Guardar" click), `firmantes` could be `[]` and overwrite `firmantes_config` with an empty array

**Fix approach**:
1. Guard `handleSave` to prevent saving if `firmantesLoaded` is still `false` (carta data not yet loaded)
2. As an additional safety measure, refuse to save an empty `firmantesConfig` if the carta already has firmantes configured (ask for confirmation or block)

**Files to modify**:
- `src/components/admin/CartaAcuerdoDetalle.tsx` — add guard in `handleSave` to prevent overwriting firmantes with empty array

