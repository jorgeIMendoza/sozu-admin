

## Plan: Corregir Creación de Usuarios para Representantes y Migración Dinámica

### Problema 1: Representantes NO se crean automáticamente

Cuando un usuario que NO es Super Admin crea una inmobiliaria, los usuarios para representantes legales y comerciales **fallan silenciosamente** porque la llamada a `create-user` no incluye una bandera que permita la creación automática.

### Problema 2: Edge function hardcodeada

La edge function `migrate-brokers-users` solo crea 2 usuarios específicos en lugar de detectar dinámicamente todos los faltantes.

---

### Cambios Propuestos

#### 1. Agregar `auto_create` para Agentes Inmobiliarios

**Archivo:** `supabase/functions/create-user/index.ts`

Modificar la validación para aceptar `auto_create` también para rol Agente Inmobiliario (3) cuando viene de una creación de inmobiliaria:

```text
// Línea 79-80 actual:
const ROLE_INMOBILIARIA = 4;
const isAutoCreateInmobiliaria = auto_create === true && rol_id === ROLE_INMOBILIARIA;

// Cambiar a:
const ROLE_INMOBILIARIA = 4;
const ROLE_AGENTE_INMOBILIARIO = 3;
const isAutoCreate = auto_create === true && (rol_id === ROLE_INMOBILIARIA || rol_id === ROLE_AGENTE_INMOBILIARIO);

// Línea 83:
if (!isAutoCreate && rolNombre !== "Super Administrador") {
```

#### 2. Agregar `auto_create: true` a las llamadas de representantes

**Archivo:** `src/pages/admin/Inmobiliarias.tsx`

Modificar las llamadas a `create-user` para representantes (líneas 533-543 y 604-614):

```text
// Para Rep. Legal (línea 533-543):
const { error: repUserError } = await supabase.functions.invoke('create-user', {
  body: {
    email: repPersona.email,
    nombre: repPersona.nombre_legal,
    rol_id: 3,
    id_persona: repPersona.id,
    id_inmobiliaria: personResult.id,
    telefono: repPersona.telefono || null,
    clave_pais_telefono: repPersona.clave_pais_telefono || null,
    auto_create: true  // <-- AGREGAR
  }
});

// Para Rep. Comercial (línea 604-614):
// Mismo cambio, agregar auto_create: true
```

#### 3. Reescribir Edge Function de Migración Dinámica

**Archivo:** `supabase/functions/migrate-brokers-users/index.ts`

Reemplazar el contenido hardcodeado con lógica dinámica:

```text
Nueva lógica de migración:

1. DETECTAR INMOBILIARIAS SIN USUARIO
   ┌─────────────────────────────────────────────────────────────┐
   │ SELECT p.id, p.nombre_legal, p.email                        │
   │ FROM personas p                                             │
   │ JOIN entidades_relacionadas er ON er.id_persona = p.id      │
   │ WHERE er.id_tipo_entidad = 5 (Inmobiliaria)                 │
   │   AND p.email IS NOT NULL                                   │
   │   AND p.activo = true                                       │
   │   AND NOT EXISTS (SELECT 1 FROM usuarios u                  │
   │                   WHERE u.email = p.email AND u.rol_id = 4) │
   └─────────────────────────────────────────────────────────────┘

2. DETECTAR REPRESENTANTES LEGALES SIN USUARIO
   ┌─────────────────────────────────────────────────────────────┐
   │ SELECT p.id, p.nombre_legal, p.email, inmo.id as inmo_id   │
   │ FROM personas inmo                                          │
   │ JOIN entidades_relacionadas er_rep                          │
   │   ON er_rep.id = inmo.id_entidad_relacionada_rep_leg        │
   │ JOIN personas p ON p.id = er_rep.id_persona                 │
   │ WHERE p.email IS NOT NULL                                   │
   │   AND p.activo = true                                       │
   │   AND NOT EXISTS (SELECT 1 FROM usuarios u                  │
   │                   WHERE u.email = p.email AND u.rol_id = 3) │
   └─────────────────────────────────────────────────────────────┘

3. DETECTAR REPRESENTANTES COMERCIALES SIN USUARIO
   (Misma lógica pero con id_entidad_relacionada_rep_com)

4. CREAR USUARIOS EN LOTES
   - Procesar en batches de 50 para evitar timeout
   - Crear auth user con contraseña temporal
   - Crear registro en usuarios
   - Para agentes: vincular a inmobiliaria y copiar acceso a proyectos
```

#### 4. Agregar Parámetros de Control

El request body aceptará:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `dry_run` | boolean | Solo detectar sin crear (para preview) |
| `limit` | number | Límite de usuarios a procesar |
| `tipo` | string | "inmobiliarias", "rep_legales", "rep_comerciales", o "todos" |

#### 5. Actualizar UI en Usuarios.tsx

Modificar el diálogo de migración para:
1. Primero llamar con `dry_run: true` para mostrar preview
2. Mostrar cuántos usuarios se crearán por categoría
3. Permitir seleccionar qué tipo migrar
4. Ejecutar la migración real al confirmar

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/create-user/index.ts` | Permitir `auto_create` para rol Agente Inmobiliario (3) |
| `src/pages/admin/Inmobiliarias.tsx` | Agregar `auto_create: true` a llamadas de representantes |
| `supabase/functions/migrate-brokers-users/index.ts` | Reescribir con lógica dinámica |
| `src/pages/admin/Usuarios.tsx` | Actualizar UI para mostrar preview y opciones |

---

### Resultado Esperado

**Al crear nueva inmobiliaria con representantes:**
- Se crearán 3 usuarios automáticamente (inmobiliaria + rep legal + rep comercial)
- Funciona independientemente del rol del usuario que crea

**Al ejecutar migración:**
- Detecta dinámicamente todos los usuarios faltantes
- Muestra preview antes de ejecutar
- Permite migrar por categoría o todos a la vez
- Contraseña temporal: `Temporal123!`

