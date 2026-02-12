

## Plan: Permitir cambiar estatus de aprobacion desde el badge en modales de ofertas

### Contexto
Actualmente el badge de estatus de aprobacion es solo informativo. Se necesita que cuando el estatus sea "Aprobacion pendiente" (ID 1), el badge sea clickeable y abra un dialogo para cambiar a: Aprobada (2), Rechazada (3) o Revisar (4). Para Rechazada y Revisar se debe permitir agregar un comentario.

### Tabla de estatus de aprobacion
| ID | Nombre | Color |
|----|--------|-------|
| 1 | Aprobacion pendiente | Amarillo |
| 2 | Aprobada | Verde |
| 3 | Rechazada | Rojo |
| 4 | Revisar | Azul |

### Cambios

**1. Nuevo componente: `src/components/admin/CambiarEstatusAprobacionDialog.tsx`**

Dialogo que recibe el `offerId` y permite:
- Seleccionar nuevo estatus (Aprobada, Rechazada, Revisar) mediante botones o radio group
- Campo de comentario (textarea) que aparece solo cuando se selecciona Rechazada o Revisar
- Al guardar: actualiza `ofertas.id_estatus_aprobacion` y `ofertas.comentario_justificacion` en Supabase
- Invalida la URL del PDF (setea `url: null`) para forzar regeneracion con el badge correcto

**2. Modificar `src/pages/admin/Propiedades.tsx`** (2 secciones)

- Seccion de ofertas de propiedad (~linea 5932): Convertir el Badge estático en un boton clickeable cuando `id_estatus_aprobacion === 1`. Al hacer click, abre el nuevo dialogo.
- Seccion de ofertas de producto (~linea 6315): Mismo cambio.

**3. Modificar `src/pages/admin/inmobiliarias/MisPropiedades.tsx`** (2 secciones)

- Seccion de ofertas de propiedad (~linea 1418): Mismo patron.
- Seccion de ofertas de producto (~linea 1540): Mismo patron.

### Detalle tecnico

El nuevo dialogo:
```
- Props: open, onOpenChange, offerId, onSuccess (callback para refrescar datos)
- Estado local: nuevoEstatus (number), comentario (string)
- Al confirmar:
  supabase.from('ofertas').update({
    id_estatus_aprobacion: nuevoEstatus,
    comentario_justificacion: comentario || null,
    url: null  // forzar regeneracion del PDF
  }).eq('id', offerId)
- Validacion: comentario obligatorio si estatus es 3 (Rechazada) o 4 (Revisar)
```

En las tablas, el badge se renderiza asi:
- Si `id_estatus_aprobacion === 1`: badge clickeable con cursor pointer que abre el dialogo
- Otros estatus: badge estatico (sin cambios)

### Archivos involucrados
- 1 archivo nuevo: `src/components/admin/CambiarEstatusAprobacionDialog.tsx`
- 2 archivos modificados: `Propiedades.tsx` y `MisPropiedades.tsx`

