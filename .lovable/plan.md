
## Plan: Boton "Recalcular Aplicaciones" en Detalle Cuenta Mantenimiento

### Objetivo
Agregar un boton en la vista de detalle de cuenta de mantenimiento que permita redistribuir automaticamente las aplicaciones de pago cuando exista una discrepancia (pagos sin aplicar a acuerdos).

### Cuando aparece el boton
El boton solo sera visible cuando el sistema detecte que hay dinero pagado pero no aplicado a acuerdos, es decir, cuando `excedente > 0.01` (total pagado - total aplicado > $0.01). Esto cubre exactamente el caso de CM-1365 donde hay $2,610 flotando sin aplicar.

### Cambios

**Archivo: `src/pages/admin/DetalleCuentaMantenimiento.tsx`**

1. Agregar estado `recalculando` para controlar el loading del boton
2. Agregar funcion `handleRecalcular` que:
   - Llama a la edge function `recalcular-aplicaciones` con el `id_cuenta_cobranza` actual
   - Muestra toast de exito/error
   - Invalida las queries de acuerdos, pagos y aplicaciones para refrescar la vista
3. Agregar el boton en la barra de acciones del header (junto a los botones existentes), con:
   - Icono de `RefreshCw` de lucide-react
   - Texto "Recalcular Aplicaciones"
   - Solo visible cuando `excedente > 0.01` (hay pagos sin aplicar)
   - Estado de carga mientras se ejecuta la funcion

### Detalle tecnico

La funcion llamara a la edge function existente `recalcular-aplicaciones`:

```typescript
const handleRecalcular = async () => {
  setRecalculando(true);
  try {
    const { data, error } = await supabase.functions.invoke('recalcular-aplicaciones', {
      body: { id_cuenta_cobranza: cuentaId }
    });
    if (error) throw error;
    // Invalidar queries para refrescar datos
    queryClient.invalidateQueries({ queryKey: ["acuerdos_mantenimiento", cuentaId] });
    queryClient.invalidateQueries({ queryKey: ["pagos_mantenimiento", cuentaId] });
    queryClient.invalidateQueries({ queryKey: ["aplicaciones_por_pago", cuentaId] });
    toast({ title: "Recalculo completado", description: "..." });
  } catch (error) {
    toast({ title: "Error", variant: "destructive" });
  } finally {
    setRecalculando(false);
  }
};
```

El boton se renderiza condicionalmente:

```tsx
{excedente > 0.01 && (
  <Button onClick={handleRecalcular} variant="outline" disabled={recalculando}>
    <RefreshCw className="h-4 w-4 mr-2" />
    Recalcular Aplicaciones
  </Button>
)}
```

No se requieren cambios en la edge function `recalcular-aplicaciones` ya que esta preparada para recibir un `id_cuenta_cobranza` y redistribuir los pagos.
