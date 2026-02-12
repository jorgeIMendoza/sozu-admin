

# Validacion de email duplicado en Registro de Inmobiliaria

## Problema
Cuando el usuario intenta registrar una inmobiliaria con un email que ya existe, el edge function `registro-inmobiliaria-publica` ya valida esto y retorna un error 400 con mensaje personalizado. Sin embargo, el cliente no muestra correctamente ese mensaje porque `supabase.functions.invoke` encapsula las respuestas no-2xx en un objeto de error generico, perdiendo el mensaje personalizado.

## Solucion

### 1. Agregar validacion client-side antes de enviar
En `src/pages/public/RegistroInmobiliaria.tsx`, dentro de `handleSubmit`, antes de llamar a `registerMutation.mutate()`, hacer una consulta directa a las tablas `personas` y `usuarios` para verificar si el email ya existe. Si existe, mostrar un toast con el mensaje:

> "Este correo ya esta registrado. Por favor, contacta al administrador."

Y no permitir continuar.

### 2. Mejorar el manejo de errores del edge function
En el `mutationFn`, cuando `supabase.functions.invoke` retorna un error (status no-2xx), extraer el body de la respuesta para obtener el mensaje personalizado del edge function en lugar de mostrar un error generico.

---

## Detalles tecnicos

### Archivo: `src/pages/public/RegistroInmobiliaria.tsx`

**Cambio 1 - Validacion pre-submit (en `handleSubmit`)**:
Despues de las validaciones existentes y antes de `registerMutation.mutate()`, agregar:

```typescript
// Verificar si el email ya existe en personas o usuarios
const emailLower = formData.email.trim().toLowerCase();

const { data: existingPersona } = await supabase
  .from('personas')
  .select('id')
  .ilike('email', emailLower)
  .eq('activo', true)
  .maybeSingle();

const { data: existingUsuario } = await supabase
  .from('usuarios')
  .select('id')
  .ilike('email', emailLower)
  .maybeSingle();

if (existingPersona || existingUsuario) {
  toast({
    title: "Correo ya registrado",
    description: "Este correo ya esta registrado. Por favor, contacta al administrador.",
    variant: "destructive",
    duration: 8000,
  });
  return;
}
```

Nota: `handleSubmit` pasara a ser `async`.

**Cambio 2 - Mejorar error handling en `mutationFn`**:
Cuando el edge function retorna un error, parsear el contexto del error para extraer el mensaje:

```typescript
if (error) {
  // Intentar extraer mensaje del body de respuesta
  let message = "Error al registrar la inmobiliaria";
  try {
    if (error.context?.body) {
      const reader = error.context.body.getReader();
      // parse response body for custom message
    }
  } catch {}
  if (data?.message) message = data.message;
  throw new Error(message);
}
```

**Cambio 3 - Mensaje en `onError`**:
Asegurar que el mensaje de error del toast incluya la indicacion de contactar al administrador cuando corresponda.

