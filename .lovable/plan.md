## Plan completado: Registro multi-rol, selector de rol en login, normalización de emails y fix de teléfono

### Cambios realizados

| Archivo | Detalle |
|---------|---------|
| `supabase/functions/registro-publico/index.ts` | Reutiliza persona/auth/usuario existentes en lugar de rechazar; solo rechaza si ya tiene entidad tipo 19 activa |
| `src/pages/auth/Login.tsx` | Selector de portal post-login cuando el usuario tiene múltiples entidades (Agente + Cliente); actualiza `rol_id` al seleccionar |
| `src/components/admin/PersonForm.tsx` | Email normalizado a minúsculas con `.toLowerCase()` |
| `supabase/functions/create-client-user/index.ts` | Email normalizado a minúsculas |
| `supabase/functions/create-user/index.ts` | Email normalizado a minúsculas |
| `supabase/functions/post-confirmacion-registro/index.ts` | Fallback de teléfono desde tabla `personas` |
| `supabase/functions/notificar-confirmacion-email/index.ts` | Fallback de teléfono desde tabla `personas` |

### Flujo multi-rol

1. `registro-publico` ya no rechaza emails existentes — reutiliza persona/auth y crea nueva entidad tipo 19
2. Al hacer login, si el usuario tiene entidades tipo 2 (Comprador) Y tipo 19 (Agente), se muestra un selector de portal
3. Al elegir portal, se actualiza `rol_id` en `usuarios` y se redirige al portal correspondiente
4. Si solo tiene un portal, redirige directamente (comportamiento anterior)
