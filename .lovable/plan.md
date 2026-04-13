

## Plan: Agregar campos de Representante Legal al formulario de registro

### Problema
El formulario actual solo captura datos de la inmobiliaria (nombre, email, teléfono) y envía los mismos valores para el representante legal. Esto causa el error de `personas_email_key` cuando ambos emails son iguales, y además el representante legal se crea con el nombre de la empresa en vez del nombre de una persona física.

### Cambios

**Archivo: `src/pages/public/RegistroInmobiliaria.tsx`**

1. Agregar campos al estado del formulario:
   - `nombre_representante` (texto, obligatorio)
   - `email_representante` (email, obligatorio)
   - `telefono_representante` (10 dígitos, obligatorio)
   - `clave_pais_telefono_representante` (selector MX/US)

2. Agregar sección "Representante Legal" en el formulario, justo después del campo "Nombre Comercial", con:
   - Input "Nombre completo del Representante Legal"
   - Input "Email del Representante Legal"
   - Selector de país + Input "Teléfono del Representante Legal"

3. Validaciones:
   - Todos los campos del representante son obligatorios
   - El email del representante **no puede ser igual** al email de la inmobiliaria (validación client-side con mensaje claro)
   - Teléfono de 10 dígitos

4. Actualizar el `mutationFn` para enviar los datos del representante por separado:
   ```typescript
   representante_legal: {
     nombre_legal: formData.nombre_representante,
     email: formData.email_representante,
     telefono: formData.telefono_representante,
     clave_pais_telefono: formData.clave_pais_telefono_representante,
   }
   ```

**Archivo: `supabase/functions/registro-inmobiliaria-publica/index.ts`**

5. Agregar validación server-side para que el email del representante legal no sea igual al de la inmobiliaria (línea ~70):
   ```typescript
   if (inmobiliariaEmailLower === repLegalEmailLower) {
     return error: "El email del representante legal no puede ser el mismo que el de la inmobiliaria"
   }
   ```

6. También validar el email del representante legal contra la tabla `personas` (actualmente solo se valida el email de la inmobiliaria en líneas 80-96), para evitar duplicados con personas existentes.

### Diseño visual
Se mantiene el mismo estilo del formulario actual (clases `login-input`, `login-btn-primary`, etc.). La sección de representante legal tendrá un separador sutil y un título "Representante Legal" para diferenciarla visualmente.

