

# Plan: Cambiar Filtro de Comisionistas a `es_rol_interno`

## Resumen

Reemplazar el filtro hardcodeado de roles específicos por una consulta que use `es_rol_interno = true`. Esto hace el sistema más flexible y mantenible.

---

## Problema Actual

```typescript
// Línea 1580 - Hardcoded roles
.in('rol_id', [1, 2, 3, 9, 10])
```

Cada vez que se crea un nuevo rol interno, hay que recordar agregarlo manualmente a esta lista.

---

## Solución Propuesta

Hacer un JOIN con la tabla `roles` para filtrar por `es_rol_interno = true`.

---

## Cambios Requeridos

### Archivo: `src/components/admin/EditCuentaCobranzaDialog.tsx`

**Ubicación**: Líneas 1577-1585

**Cambio**: Reemplazar la consulta actual por una que haga JOIN con roles:

```typescript
// ANTES:
const { data } = await supabase
  .from('usuarios')
  .select('email, nombre')
  .in('rol_id', [1, 2, 3, 9, 10])
  .or(`email.ilike.%${searchUsuario}%,nombre.ilike.%${searchUsuario}%`)
  .not('email', 'in', existingEmails.length > 0 ? `(${existingEmails.map(e => `"${e}"`).join(',')})` : '("")')
  .limit(10);

// DESPUÉS:
const { data } = await supabase
  .from('usuarios')
  .select('email, nombre, roles!inner(es_rol_interno)')
  .eq('roles.es_rol_interno', true)
  .or(`email.ilike.%${searchUsuario}%,nombre.ilike.%${searchUsuario}%`)
  .not('email', 'in', existingEmails.length > 0 ? `(${existingEmails.map(e => `"${e}"`).join(',')})` : '("")')
  .limit(10);
```

---

## Beneficios

| Aspecto | Antes | Después |
|---------|-------|---------|
| Mantenibilidad | Actualizar lista manualmente | Automático basado en flag |
| Nuevos roles | Requiere cambio de código | Solo configurar `es_rol_interno` |
| Exclusión de externos | Manual | Automática (Directores, Cliente) |

---

## Usuarios Ahora Incluidos

Con este cambio, todos los usuarios con roles internos podrán ser comisionistas:

- Super Administrador (1)
- Administrador de Proyecto (2)
- Agente Inmobiliario (3)
- Inmobiliaria (4)
- Vendedor (5)
- Agente Interno (9)
- Administrador de data (10)
- Administrador de finanzas (21) ← **Alma Castellón**
- Administracion de pagos interna (22)
- Y todos los demás roles internos...

---

## Usuarios Excluidos Automáticamente

- Directores (19) - `es_rol_interno = false`
- Cliente (23) - `es_rol_interno = false`

---

## Nota sobre Inmobiliarias

La búsqueda de Inmobiliarias (personas morales en tabla `personas`) **se mantiene igual**. Estas ya se buscan por separado en las líneas 1591-1618 y se combinan con los usuarios internos.

---

## Flujo Final de Búsqueda

```text
Usuario escribe en búsqueda
         │
         ▼
┌────────────────────────────────┐
│ Búsqueda en paralelo          │
├────────────────────────────────┤
│ 1. usuarios                    │
│    WHERE roles.es_rol_interno  │
│    = true                      │
├────────────────────────────────┤
│ 2. personas                    │
│    WHERE tipo_persona = 'pm'   │
│    (Inmobiliarias)             │
└────────────────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Combinar resultados            │
│ - Usuarios internos            │
│ - Inmobiliarias (badge)        │
└────────────────────────────────┘
         │
         ▼
    Mostrar dropdown
```

