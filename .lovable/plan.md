## Objetivo

1. Implementar **multi-rol** (un mismo email puede tener varios roles).
2. Cuando se intente dar de alta un email que ya existe con otro rol, **notificar a quien lo está dando de alta y pedir confirmación explícita** antes de agregar el nuevo rol.
3. **Caso puntual:** dejar a `luis.munoz@investimento.mx` con ambos roles **3 (Agente Inmobiliario)** y **23 (Cliente)** activos.

---

## Arquitectura

### 1. Tabla `user_roles` (nueva)

```text
user_roles
├── id (uuid pk)
├── email (text, lower)
├── rol_id (int → roles.id)
├── activo (boolean default true)
├── es_principal (boolean)        -- rol "default" para login
├── creado_por (text email)
├── fecha_creacion / fecha_actualizacion
└── UNIQUE (email, rol_id)
```

- RLS: lectura para `is_super_admin()` y para el propio usuario; escritura solo service role / super admin.
- Helper: `public.user_has_role(_email text, _rol_id int) returns boolean`.
- `usuarios.rol_id` se conserva como **rol principal** (compatibilidad con todo el código existente). `user_roles` lleva el catálogo completo.

> Por la regla de proyecto, el DDL se entrega como SQL para que tú lo ejecutes manualmente en dev y prod (no se ejecuta desde Lovable).

### 2. Backfill general

Insert masivo: copiar `(email, rol_id)` actual de `usuarios` a `user_roles` con `es_principal = true, activo = true`.

### 3. Caso puntual `luis.munoz@investimento.mx`

DML adicional al backfill (lo entrego como SQL para que tú lo ejecutes):

```sql
-- 1. Asegurar rol 3 (Agente) — ya saldrá del backfill, idempotente:
INSERT INTO public.user_roles (email, rol_id, activo, es_principal, creado_por)
VALUES ('luis.munoz@investimento.mx', 3, true, true, 'system-backfill')
ON CONFLICT (email, rol_id) DO UPDATE SET activo = true;

-- 2. Agregar rol 23 (Cliente) como rol secundario:
INSERT INTO public.user_roles (email, rol_id, activo, es_principal, creado_por)
VALUES ('luis.munoz@investimento.mx', 23, true, false, 'system-fix-luis')
ON CONFLICT (email, rol_id) DO UPDATE SET activo = true;

-- 3. NO se modifica usuarios.rol_id (sigue como 3 = Agente, su rol principal).
-- 4. Disparar el flujo de confirmación de email para portal clientes
--    (se hace desde la UI invocando "Reenviar confirmación" sobre ese email,
--     o llamando manualmente a create-client-user con confirmAddRole=true).
```

### 4. Edge Function `create-client-user` (modificada)

Nuevo contrato:

**Body:** `{ email, nombre, id_persona, confirmAddRole?: boolean }`

**Lógica:**
1. Buscar usuario por email en `usuarios`.
2. **No existe** → crear como hoy con rol 23 + insertar en `user_roles`.
3. **Existe y ya tiene rol 23 activo** en `user_roles` → flujo actual (solo reenvío de confirmación).
4. **Existe con otro rol** y `confirmAddRole !== true` → **no modifica nada**, responde HTTP **409**:
   ```json
   {
     "status": "role_conflict",
     "existingRoles": [{ "id": 3, "nombre": "Agente Inmobiliario" }],
     "message": "El email ya está registrado como Agente Inmobiliario. ¿Deseas agregarle también el rol Cliente?"
   }
   ```
5. **`confirmAddRole === true`** → insertar `user_roles(email, rol_id=23, es_principal=false, activo=true)` (sin tocar `usuarios.rol_id`) y enviar correo de confirmación para activar acceso al portal de clientes.

> Por la regla de proyecto, el código Deno se entrega para que tú lo despliegues manualmente.

### 5. Frontend

**a) Modal de confirmación**
- En `src/pages/admin/UsuariosClientes.tsx` (alta individual y sincronización masiva): capturar respuesta `409 / status: "role_conflict"`.
- Abrir `<AlertDialog>`:
  > "El correo **{email}** ya está registrado como **{existingRoleName}**. ¿Deseas agregarle también el rol **Cliente** para que pueda acceder al portal de clientes con la misma cuenta?"
  > Botones: **Cancelar** / **Sí, agregar rol Cliente**.
- Al confirmar → reinvocar la edge function con `confirmAddRole: true`.
- En sync masiva: acumular conflictos y mostrar un único modal final con la lista, checkboxes individuales y "Confirmar todos".

**b) Lectura de roles**
- `AuthContext.fetchProfile`: además del `get_current_user_profile`, traer `user_roles` activos del email autenticado y exponerlos como `profile.roles: number[]`.
- `usePermissions`, `useAllowedMenus`, guards de rutas, sidebar y selector multi-portal: usar `profile.roles` (fallback a `[profile.rol_id]`) para decidir qué portales/menús mostrar.
- Selector multi-portal existente (memoria `multi-role-login-selector`): poblar opciones desde `profile.roles`. Cambiar de portal **no requiere** modificar `usuarios.rol_id`; basta con setear el portal activo en contexto/localStorage y redirigir al subdominio correspondiente.

---

## Flujo de Luis tras los cambios

1. Backfill + DML puntual → `user_roles` queda con filas (luis, 3, principal) y (luis, 23, secundario).
2. `usuarios.rol_id` se queda en 3 (no rompe nada de lo existente como Agente).
3. Desde "Sistema → Usuarios Clientes" aparecerá Luis (porque ahora la lista filtra por presencia de rol 23 en `user_roles`, no solo por `rol_id`).
4. Luis puede entrar a `agentes.sozu.com` (rol 3) y a `clientes.sozu.com` (rol 23) con el mismo email/password.

---

## Entregables

1. **SQL** (DDL `user_roles` + RLS + helper + backfill + DML puntual de Luis) — para ejecución manual.
2. **Código Deno** actualizado de `create-client-user` — para deploy manual.
3. **Cambios frontend** (Lovable los aplica):
   - Hook `useCreateClientUserWithConfirmation`.
   - Modal de conflicto en `UsuariosClientes.tsx` (alta individual + sync masiva).
   - Ajuste en `AuthContext` para cargar `profile.roles`.
   - Ajuste en hooks de permisos / sidebar / selector multi-portal para considerar todos los roles activos.
   - Ajuste del filtro "Usuarios Clientes" para listar también a quienes tengan rol 23 en `user_roles` (no solo `usuarios.rol_id = 23`).

## Fuera de alcance

- Trigger automático tras pago de apartado (vive en N8N): a futuro, ajustarlo para que llame con `confirmAddRole: true` cuando el contexto sea claramente "el cliente pagó".
- UI completa de gestión multi-rol en `ChangeUserRoleDialog` (hoy es selector único; queda igual y solo cambia el rol principal).

¿Procedo?
