
## Objetivo

Corregir que `contacto@vivaltainmobiliaria.com` sí aparezca en `Sistema → Usuarios del Sistema` y agregar búsqueda por correo en la vista de `Inmobiliarias`.

## Diagnóstico actualizado

Ya confirmé que en base de datos el usuario sí existe y está correcto:

- `usuarios.email = contacto@vivaltainmobiliaria.com`
- `rol_id = 4` (`Inmobiliaria`)
- `activo = true`
- `roles.es_rol_interno = true`
- `id_persona = 1876`
- la persona ligada también tiene el mismo correo

Además, el código actual de `src/pages/admin/Usuarios.tsx` sí intenta consumir la Edge Function `list-system-users`, y la función en el repositorio sí debería devolver usuarios con rol 4.

Eso significa que el problema ya no apunta a “datos mal capturados”, sino a una discrepancia entre lo que está en BD y lo que realmente está llegando a la UI. Las causas más probables son:

1. la función desplegada no coincide con el código actual,
2. el frontend publicado/preview no está consumiendo la versión correcta,
3. falta visibilidad de error en la pantalla y el resultado se queda en un estado “vacío” sin explicar qué falló.

## Cambios a implementar

### 1) Corregir definitivamente `Usuarios del Sistema`
Haré el ajuste en dos capas:

- Validar y alinear la fuente real que usa la tabla:
  - asegurar que `src/pages/admin/Usuarios.tsx` consuma la respuesta correcta de `list-system-users`,
  - redeploy de la Edge Function para garantizar que el código en Supabase sea el mismo que ya está en el repositorio,
  - verificar la respuesta real de la función con el usuario autenticado.

- Endurecer la UI para que no oculte el problema:
  - agregar manejo explícito de error en la consulta de usuarios,
  - mostrar mensaje de error si la función devuelve 401/403/500,
  - evitar que un fallo termine viéndose como “0 resultados”.

- Revisar el filtrado en cliente:
  - confirmar que el usuario rol 4 no sea descartado por filtros adicionales,
  - mantener la lógica de `Administrador de Proyecto` solo para roles 3 y 4,
  - conservar búsqueda por nombre/email/rol.

### 2) Agregar búsqueda por correo en `Inmobiliarias`
Modificaré el filtro actual de `src/pages/admin/Inmobiliarias.tsx` para que también busque por:

- `personas.email` de la inmobiliaria,
- `usuario_email` del usuario principal ligado a la inmobiliaria, cuando exista.

También actualizaré:

- placeholder del buscador para reflejar que ya acepta correo,
- conteos por pestaña (`Activos`, `Draft`, `Eliminados`) para que usen el mismo criterio nuevo y no queden inconsistentes.

## Resultado esperado

Después del ajuste:

### En `Usuarios del Sistema`
Si buscas `contacto@vivaltainmobiliaria.com`:

- debe aparecer en la tabla,
- debe mostrarse con rol `Inmobiliaria`,
- debe seguir respetando permisos según el usuario que consulta.

### En `Inmobiliarias`
La búsqueda deberá encontrar registros por:

- nombre legal,
- nombre comercial,
- RFC,
- correo de la inmobiliaria,
- correo del usuario ligado.

## Verificaciones que haré

1. Buscar `contacto@vivaltainmobiliaria.com` en `Usuarios del Sistema` y confirmar que aparezca.
2. Confirmar que el conteo de `Activos` deje de ser `0` para esa búsqueda.
3. Buscar el mismo correo en `Inmobiliarias` y confirmar coincidencia.
4. Probar una búsqueda por nombre/RFC para asegurar que no se rompa el comportamiento actual.
5. Validar escenario con rol administrativo permitido y sin abrir permisos de más.

## Detalles técnicos

### Archivos involucrados
- `src/pages/admin/Usuarios.tsx`
- `src/pages/admin/Inmobiliarias.tsx`
- `supabase/functions/list-system-users/index.ts`

### Ajuste técnico en Usuarios
- agregar estado de error del `useQuery`,
- mostrar error real en vez de presentar vacío,
- validar/redeploy de la Edge Function para eliminar discrepancia entre código y entorno desplegado.

### Ajuste técnico en Inmobiliarias
El filtro pasará de esto:

```ts
nombre_legal || nombre_comercial || rfc
```

a incluir también:

```ts
email || usuario_email
```

y los contadores por tab usarán exactamente el mismo predicado de búsqueda.

## Nota importante

La evidencia actual indica que el registro sí existe correctamente en BD; por eso la corrección debe enfocarse en la capa de lectura/despliegue y no en recrear o editar el usuario.
