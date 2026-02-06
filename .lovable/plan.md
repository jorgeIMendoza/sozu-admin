

## Problem

The "Comisiones Externas" view shows no data because the Supabase query is using the wrong foreign key name for the relationship between `propiedades` and `estatus_disponibilidad`.

The query uses:
```
estatus_disponibilidad!propiedades_id_estatus_disponibilidad_fkey(id, nombre)
```

But the actual foreign key in the database is:
```
fk_propiedades_estatus_disp
```

This causes a **400 error** from PostgREST, which makes the entire query fail and return no results.

## Fix

A single change in `src/pages/admin/ComisionesExternas.tsx`:

Replace the incorrect foreign key hint on the `estatus_disponibilidad` join inside the ofertas query (around line 163):

**Before:**
```
estatus_disponibilidad!propiedades_id_estatus_disponibilidad_fkey(id, nombre)
```

**After:**
```
estatus_disponibilidad!fk_propiedades_estatus_disp(id, nombre)
```

This is the only change needed -- the rest of the status display logic (badges, approve button restriction) is already correctly implemented from the previous edit.

## Technical Details

- **File**: `src/pages/admin/ComisionesExternas.tsx`, line ~163
- **Root cause**: Incorrect foreign key hint in the Supabase `.select()` query
- **Correct FK name**: `fk_propiedades_estatus_disp` (confirmed from the TypeScript types file)
- **Impact**: Once fixed, the query will succeed, all commission data will load again, the status column will display correctly, and the "Aprobar" button will only be enabled for properties with "Vendido" status (ID 5)

