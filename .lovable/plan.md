

## Problem

The period filter ("Este mes", "Mes pasado", "Últimos 3 meses", "Año actual") is decorative — selecting a different period does nothing because:

1. **The RPC `get_dashboard_cobranza_kpis` has no date parameters** — it hardcodes `v_mes_inicio` and `v_mes_fin` to the current month (`date_trunc('month', current_date)`).
2. **The frontend never passes the period** — `period` is stored in React state but not sent to the hook or the RPC.

## Plan

### Step 1: Update the RPC to accept date range parameters

Add two new optional parameters `p_fecha_inicio` and `p_fecha_fin` to the function. When provided, they replace the hardcoded current-month range for:
- `v_cobrado_mes` (cobrado in the period)
- `v_programado_mes` (programado in the period)
- `recovery_rate` calculation
- `cobrado_mensual` and `programado_mensual` series (adjust the 12-month window accordingly)

The "total" fields (`cobrado_total`, `vencido_total`, `pendiente_total`), aging, and morosidad remain unaffected by the period (they are point-in-time snapshots).

Migration SQL: `ALTER` or `CREATE OR REPLACE` the function with the new signature.

### Step 2: Map UI period to date range in the frontend

In `CobranzaDashboard.tsx`, compute `fechaInicio` and `fechaFin` from the selected period:
- "Este mes" → 1st of current month to end of current month
- "Mes pasado" → 1st of previous month to end of previous month
- "Últimos 3 meses" → 1st of 3 months ago to today
- "Año actual" → Jan 1 of current year to today

### Step 3: Pass dates through the hook

Update `useCobranzaDashboard` to accept optional `fechaInicio` and `fechaFin` parameters and pass them as `p_fecha_inicio` / `p_fecha_fin` to the RPC call. Include them in the `queryKey` so React Query refetches on period change.

### Step 4: Update KPI labels

Change the sub-labels like "Meta del periodo" and card titles to reflect the selected period (e.g., "Cobrado — Mes pasado" instead of always "Cobrado del Mes").

### Files affected
- **Database migration**: `CREATE OR REPLACE FUNCTION get_dashboard_cobranza_kpis` with new params
- `src/hooks/useCobranzaDashboard.ts` — add date params to hook and RPC call
- `src/pages/admin/portal-cobranza/CobranzaDashboard.tsx` — compute dates from period, pass to hook, update labels

