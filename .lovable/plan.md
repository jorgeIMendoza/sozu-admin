
# Plan: Edge Function de Migración Única para Usuarios Inmobiliaria

## Resumen

Crear una Edge Function `migrate-inmobiliaria-users` que se ejecutará una sola vez para:
1. Crear cuentas de autenticación para 3 inmobiliarias (DAC, INTERAMERICAN, KRE)
2. Crear registros en tabla `usuarios` para 5 inmobiliarias (excluyendo Sozu que ya es Super Admin)
3. Opcionalmente asignar proyectos y propagar acceso a agentes

## Situación Actual

| Inmobiliaria | Email | Persona ID | auth.users | usuarios |
|--------------|-------|------------|------------|----------|
| DAC | dac@gmail.com | 2265 | ❌ No existe | ❌ No existe |
| INTERAMERICAN | atencion@interamerican.com.mx | 1882 | ❌ No existe | ❌ No existe |
| KRE | contacto@krinmobiliaria.com | 1880 | ❌ No existe | ❌ No existe |
| TRUST | bb@trustreal.mx | 1874 | ✅ Existe | ❌ No existe |
| VIVALTA | contacto@vivaltainmobiliaria.com | 1876 | ✅ Existe | ❌ No existe |
| Sozu | joseramon.escobar@sozu.com | 186 | ✅ Existe | ✅ Ya tiene usuario (Super Admin) |

## Implementación

### Archivo a Crear

```
supabase/functions/migrate-inmobiliaria-users/index.ts
```

### Lógica de la Edge Function

1. Verificar que el solicitante sea Super Admin
2. Obtener las 5 inmobiliarias candidatas (excluyendo Sozu)
3. Para cada una:
   - Si no existe auth.user: crear con contraseña temporal
   - Si ya existe auth.user: obtener su ID
   - Crear registro en `usuarios` con rol_id = 4
4. Retornar resumen de operaciones

### Configuración

Agregar en `supabase/config.toml`:
```toml
[functions.migrate-inmobiliaria-users]
verify_jwt = false
```

### Request/Response

**Request:**
```json
{}  // Sin parámetros, detecta automáticamente
```

**Response:**
```json
{
  "success": true,
  "created": [
    { "email": "dac@gmail.com", "authCreated": true, "usuarioCreated": true },
    { "email": "atencion@interamerican.com.mx", "authCreated": true, "usuarioCreated": true },
    { "email": "contacto@krinmobiliaria.com", "authCreated": true, "usuarioCreated": true },
    { "email": "bb@trustreal.mx", "authCreated": false, "usuarioCreated": true },
    { "email": "contacto@vivaltainmobiliaria.com", "authCreated": false, "usuarioCreated": true }
  ],
  "message": "Migración completada. Contraseña temporal: Temporal123!"
}
```

## Uso

1. Ejecutar la Edge Function una vez desde el frontend o curl
2. Verificar que los usuarios se crearon correctamente
3. Eliminar la Edge Function ya que no se usará de nuevo

## Consideraciones

- **Contraseña temporal**: `Temporal123!` - todos deben cambiarla
- **Email confirmado**: Se marcarán como confirmados automáticamente
- **Trigger existente**: Una vez creados los usuarios, cuando les asignes proyectos el trigger `sync_inmobiliaria_project_access` propagará el acceso a sus agentes automáticamente
