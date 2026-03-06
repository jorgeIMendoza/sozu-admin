
## Plan: Show "Comisión" for all inmobiliarias (not just Sozu)

Currently, the "Comisión" tab in the bar chart and the "Comisión" column in the agent performance table are restricted to Sozu only (`isSozu` checks). The commission calculation logic (`comisionByCuentaId`) already handles both Sozu and non-Sozu cases correctly. The fix is to remove the `isSozu` gates on the UI elements.

### Changes in `InmobDashboard.tsx`:

1. **Remove the `useEffect` that resets chart mode** (lines 231-233) — no longer needed since all inmobiliarias can view commission.

2. **Chart toggle buttons** (line 1309): Remove the `isSozu` condition that hides the "Comisión" tab. Show it for all inmobiliarias.

3. **Table header** (line 1379): Remove `isSozu &&` gate on the "Comisión" column header. Rename to "Comisión Inmobiliaria".

4. **Table body cells** (lines 1404-1408): Remove `isSozu &&` gate on the commission cell.

5. **Empty row colspan** (line 1418): Update colspan from conditional `isSozu ? 9 : 8` to always `9`.

6. **Update label** in chart tooltip (line 1323) and chart toggle (line 1309) to say "Comisión" (keep as is, it's clear in context).
