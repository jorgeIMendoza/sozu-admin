

## Plan: Pantalla "Olvidé mi contraseña" (Clientes + Agentes + Inmobiliarias)

### Resumen
Crear página `/auth/forgot-password` que permita a cualquier usuario activo (Cliente, Agente Inmobiliario, Inmobiliaria, Agente Interno) recuperar su contraseña, reutilizando `reset-user-password`.

### Cambios

**1. Modificar `supabase/functions/reset-user-password/index.ts`**
- Agregar modo público (sin JWT ni API key)
- Buscar usuario por email con `activo = true`
- Restringir a roles permitidos: Cliente (23), Agente Inmobiliario (3), Inmobiliaria (4), Agente Interno (9)
- Si no cumple condiciones, devolver error genérico 404
- Si cumple, ejecutar el `resetPassword()` existente (genera contraseña temporal, marca `debe_cambiar_password = true`, `email_confirmado = false`, envía correo de confirmación)

**2. Crear `src/pages/auth/ForgotPassword.tsx`**
- Diseño limpio consistente con Login (logo Sozu, card centrada)
- Campo email + botón "Validar" con estado loading
- Invoca `supabase.functions.invoke('reset-user-password', { body: { email } })` sin auth headers
- Error: "No se encontró una cuenta activa con ese correo"
- Exito: "Se ha reseteado tu contraseña. Revisa tu correo para confirmar tu email y recibir tus nuevas credenciales temporales"
- Botón "Volver al inicio de sesión" → `/auth/login`

**3. Agregar ruta en `src/App.tsx`**
- `/auth/forgot-password` → `<ForgotPassword />`

**4. Actualizar `src/pages/auth/Login.tsx`**
- Reemplazar el botón "¿Olvidaste tu contraseña?" que muestra mensaje de "contacta a tu asesor" por un `navigate('/auth/forgot-password')`
- Eliminar `showForgotMessage` state y el bloque inline

### Archivos
- **Modificar**: `supabase/functions/reset-user-password/index.ts`
- **Crear**: `src/pages/auth/ForgotPassword.tsx`
- **Modificar**: `src/App.tsx`
- **Modificar**: `src/pages/auth/Login.tsx`

