
## Plan: Sincronizar Teléfono entre Tablas `usuarios` y `personas`

### Problema Identificado

El usuario `jorge.mendoza@sozu.com` tiene teléfonos diferentes en cada tabla:
- **`usuarios.telefono`**: `7225458999` (incorrecto)
- **`personas.telefono`**: `7221514185` (correcto)
- **`personas.clave_pais_telefono`**: `NULL` (falta el código de país)

El diálogo "Editar mis datos" (`UserSettingsDialog.tsx`) actualiza solo la tabla `personas`, pero el webhook de notificaciones lee de `usuarios`. Esto causa la discrepancia.

---

### Cambios Propuestos

#### 1. Corrección Inmediata de Datos

Ejecutar update en la BD para corregir los datos de `jorge.mendoza@sozu.com`:

```sql
-- Actualizar usuarios con el teléfono correcto
UPDATE usuarios 
SET telefono = '7221514185', 
    clave_pais_telefono = 'MX'
WHERE email = 'jorge.mendoza@sozu.com';

-- Actualizar personas con el código de país
UPDATE personas 
SET clave_pais_telefono = 'MX'
WHERE id = 1113;
```

#### 2. Sincronización Automática en `UserSettingsDialog.tsx`

Modificar la función `handleProfileUpdate` (líneas 205-273) para que también actualice la tabla `usuarios` cuando se modifique el teléfono o código de país:

**Archivo**: `src/components/admin/UserSettingsDialog.tsx`

```typescript
// Después de actualizar personas (línea 253):
// Sincronizar teléfono con tabla usuarios
if (data.telefono !== undefined || data.clave_pais_telefono !== undefined) {
  await supabase
    .from('usuarios')
    .update({ 
      telefono: data.telefono,
      clave_pais_telefono: data.clave_pais_telefono,
      fecha_actualizacion: new Date().toISOString()
    })
    .eq('email', profile.email);
}
```

#### 3. Sincronización en `MiInformacion.tsx` (Inmobiliarias)

Modificar el mutation para que también actualice `usuarios` cuando la inmobiliaria edite su teléfono:

**Archivo**: `src/pages/admin/inmobiliarias/MiInformacion.tsx`

```typescript
// En updateMutation, después de actualizar personas:
// Sincronizar teléfono con usuarios si la inmobiliaria tiene usuario asociado
if (cleanPersonData.telefono !== undefined || cleanPersonData.clave_pais_telefono !== undefined) {
  const { data: usuarioData } = await supabase
    .from('usuarios')
    .select('email')
    .eq('id_persona', inmobiliariaId)
    .maybeSingle();
    
  if (usuarioData?.email) {
    await supabase
      .from('usuarios')
      .update({ 
        telefono: cleanPersonData.telefono,
        clave_pais_telefono: cleanPersonData.clave_pais_telefono
      })
      .eq('email', usuarioData.email);
  }
}
```

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/UserSettingsDialog.tsx` | Sincronizar teléfono con `usuarios` al guardar |
| `src/pages/admin/inmobiliarias/MiInformacion.tsx` | Sincronizar teléfono con `usuarios` al guardar |

### Corrección de Datos (Manual)

Actualizar en BD:
- `usuarios.telefono` = `7221514185` para `jorge.mendoza@sozu.com`
- `usuarios.clave_pais_telefono` = `MX`
- `personas.clave_pais_telefono` = `MX` para persona ID 1113

---

### Resultado Esperado

Cuando cualquier usuario edite su teléfono desde "Editar mis datos":
1. Se actualiza en tabla `personas`
2. Se sincroniza automáticamente en tabla `usuarios`
3. El webhook de notificaciones usará el teléfono correcto
