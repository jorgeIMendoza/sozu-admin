

## Plan: Mostrar estatus de aprobacion solo cuando hay esquema de pago seleccionado

Actualmente el badge de estatus de aprobacion se muestra siempre en los modales de ofertas y en los PDFs. Debe mostrarse unicamente cuando la oferta tiene un `id_esquema_pago_seleccionado` asignado (no null).

---

### Cambios

#### 1. `src/pages/admin/Propiedades.tsx` - Modales de ofertas comerciales y productos

En las celdas de "Estatus Aprob.", agregar condicion: solo mostrar el badge si la oferta tiene `id_esquema_pago_seleccionado` (o el campo equivalente en productos). Si no tiene esquema, mostrar "-" o dejarlo vacio.

```typescript
// En lugar de siempre mostrar el badge:
offer.id_esquema_pago_seleccionado ? (
  <Badge ...>{statusName}</Badge>
) : (
  <span className="text-muted-foreground">-</span>
)
```

#### 2. `src/pages/admin/inmobiliarias/MisPropiedades.tsx` - Mismos modales

Mismo cambio condicional en ambos modales (ofertas comerciales y productos).

#### 3. `src/services/ofertaPdfNativeService.ts` - PDF de propiedad

En la seccion donde se dibuja el badge de estatus junto al nombre del esquema (~linea 586), agregar condicion: solo dibujar el badge si hay esquema de pago seleccionado. Si no hay esquema, omitir el badge.

#### 4. `src/services/ofertaProductoPdfNativeService.ts` - PDF de producto

Mismo cambio condicional al dibujar el badge.

#### 5. `supabase/functions/generar-oferta-pdf/index.ts` - Edge function

En ambas secciones (propiedad ~linea 863 y producto ~linea 1702), condicionar el dibujo del badge a que exista `id_esquema_pago_seleccionado` en la oferta.

#### 6. `src/services/ofertaPdfStorageService.ts` - Validacion de regeneracion

La validacion que fuerza regeneracion cuando `id_estatus_aprobacion !== 2` tambien debe condicionarse a que exista esquema de pago seleccionado. Si no hay esquema, no aplicar esta regla.

---

### Resumen de archivos a modificar
1. `src/pages/admin/Propiedades.tsx` - Condicionar badge en modales
2. `src/pages/admin/inmobiliarias/MisPropiedades.tsx` - Condicionar badge en modales
3. `src/services/ofertaPdfNativeService.ts` - Condicionar badge en PDF
4. `src/services/ofertaProductoPdfNativeService.ts` - Condicionar badge en PDF
5. `supabase/functions/generar-oferta-pdf/index.ts` - Condicionar badge en edge function
6. `src/services/ofertaPdfStorageService.ts` - Condicionar validacion de regeneracion
