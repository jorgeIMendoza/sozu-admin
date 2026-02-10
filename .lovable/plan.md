

## Plan: Agregar actualizacion de estatus de propiedad a "Entregado" despues del webhook

### Problema
La funcion `procesarUltimoDocumento` en `DocumentsTab.tsx` llama al webhook de N8N para generar la cuenta de mantenimiento, pero **no actualiza el estatus de la propiedad a "Entregado" (8)**. Depende completamente de que N8N lo haga. Si el workflow de N8N no tiene ese paso o falla silenciosamente, la propiedad queda en su estatus anterior.

### Solucion
Agregar la actualizacion del estatus de la propiedad directamente en el frontend, despues de que el webhook responda exitosamente. Esto hace el sistema mas robusto y no depende de que N8N maneje correctamente ese paso.

### Cambios

**Archivo: `src/components/admin/DocumentsTab.tsx`**

En la funcion `procesarUltimoDocumento`, despues de la linea donde se valida `response.ok` y antes del toast de exito, agregar:

```typescript
// Actualizar estatus de propiedad a "Entregado" (8)
const { error: statusError } = await supabase
  .from('propiedades')
  .update({ id_estatus_disponibilidad: 8 })
  .eq('id', ofertaData.id_propiedad);

if (statusError) {
  console.error('Error actualizando estatus de propiedad:', statusError);
  // No lanzar error - la cuenta de mantenimiento ya se genero
  toast({
    title: "Advertencia",
    description: "La cuenta de mantenimiento se genero pero no se pudo actualizar el estatus de la propiedad a Entregado",
    variant: "destructive",
  });
}
```

### Resultado
- La propiedad se actualiza a estatus "Entregado" (8) inmediatamente despues de que el webhook genera la cuenta de mantenimiento
- Si la actualizacion del estatus falla, se muestra una advertencia pero no se bloquea el flujo (la cuenta de mantenimiento ya fue creada)
- Es una solucion resiliente: si N8N tambien actualiza el estatus, la operacion es idempotente (actualizar a 8 cuando ya es 8 no causa problemas)

### Archivo a modificar
- `src/components/admin/DocumentsTab.tsx` (unico archivo)

