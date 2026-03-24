

## Plan: Agregar confirmación de email para el rol Cliente

### Contexto actual
- Los roles **Agente Inmobiliario (3)** e **Inmobiliaria (4)** requieren confirmación de email antes de poder acceder. Se registran con `email_confirmado = false` y muestran un badge "✉ Pendiente".
- Los **Clientes (23)** actualmente se crean vía `create-client-user` que auto-confirma el email (`email_confirm: true`) y asigna contraseña temporal `Temporal123!`. No pasan por confirmación de email.

### Cambios propuestos

**1. Edge Function `create-client-user`**
- Agregar el paso de enviar un correo de confirmación al cliente (similar al flujo de `reenviar-confirmacion-email`).
- Marcar `email_confirmado = false` en la tabla `usuarios` al crear/sincronizar el cliente.
- Al confirmar el email (clic en el enlace), el flujo existente de `post-confirmacion-registro` marcará `email_confirmado = true` y enviará las credenciales.

**2. Vista `UsuariosClientes.tsx`**
- Agregar columna "Email Confirmado" con badges: "✉ Pendiente" (naranja) si `email_confirmado === false`, "Confirmado" (verde) si `true`.
- Agregar botón "Reenviar Confirmación" en la columna de acciones para clientes con `email_confirmado = false`, invocando la edge function `reenviar-confirmacion-email`.
- Incluir `email_confirmado` en el query de datos.

**3. ProtectedRoute / Login**
- El cliente con `email_confirmado = false` ya tiene acceso bloqueado si no tiene `auth_user_id` sincronizado o si `debe_cambiar_password` lo redirige. No se requieren cambios adicionales en el flujo de autenticación ya que el cliente no recibe credenciales hasta confirmar.

### Archivos a modificar
- `supabase/functions/create-client-user/index.ts` — enviar email de confirmación y marcar `email_confirmado = false`
- `src/pages/admin/UsuariosClientes.tsx` — columna de estado de email, botón de reenvío, tipo actualizado

