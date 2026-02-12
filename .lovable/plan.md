

## Plan: Agregar estatus de aprobacion en PDFs, validacion de regeneracion y modal de ofertas

### 1. Mostrar badge de estatus de aprobacion junto al nombre del esquema en los PDFs

Los estatus son:
- **1**: Aprobacion pendiente (amarillo/naranja)
- **2**: Aprobada (verde)
- **3**: Rechazada (rojo)
- **4**: Revisar (azul)

#### Archivos de generacion PDF a modificar:

**`src/services/ofertaPdfNativeService.ts`** (propiedad)
- Agregar `id_estatus_aprobacion` y `estatus_aprobacion_nombre` a la interfaz `GeneratePDFData` (recibirlo desde `htmlToPdfService`)
- Junto al `scheme.nombre` (linea ~586), dibujar un badge de texto con fondo de color segun el estatus. Ejemplo: `"Plan A [Aprobacion pendiente]"` con fondo amarillo

**`src/services/ofertaProductoPdfNativeService.ts`** (producto)
- Mismo cambio: junto al `scheme.nombre` (linea ~396), agregar badge de estatus

**`src/services/htmlToPdfService.ts`** (orquestador)
- En `generateOfferPDF` (linea ~110), al hacer el select de `ofertas`, ya se usa `select('*')` que incluye `id_estatus_aprobacion`
- Buscar el nombre del estatus en la tabla `estatus_aprobacion` y pasarlo a los servicios nativos
- Pasar `id_estatus_aprobacion` y `estatus_aprobacion_nombre` en el objeto de datos hacia `ofertaPdfNativeService.generateOfferPDF()` y `ofertaProductoPdfNativeService.generateOfferPDF()`

**`supabase/functions/generar-oferta-pdf/index.ts`** (edge function)
- Incluir `id_estatus_aprobacion` en el query de la oferta
- Buscar el nombre del estatus en `estatus_aprobacion`
- En ambas secciones donde se dibuja `scheme.nombre` (lineas ~863 y ~1702), agregar badge de color

### 2. Incluir `id_estatus_aprobacion` en la validacion de regeneracion

**`src/services/ofertaPdfStorageService.ts`**
- En `fetchOfferWithAllData`, agregar `id_estatus_aprobacion` al select
- En la interfaz `OfferFullData`, agregar `id_estatus_aprobacion: number | null`
- En `validateCriticalData`, agregar una validacion: si `id_estatus_aprobacion` cambio (comparar contra un valor almacenado o simplemente invalidar si es distinto de 2), forzar regeneracion. La estrategia sera: siempre invalidar si el estatus no es null y el PDF ya existe, ya que no guardamos el estatus con el que se genero originalmente

### 3. Agregar columna "Estatus Aprobacion" en los modales de ofertas

**`src/pages/admin/Propiedades.tsx`**

*Ofertas comerciales (dialog linea ~5738):*
- Agregar `<TableHead>Estatus</TableHead>` en el header (despues de "Esquema de Pago")
- Agregar `<TableCell>` con un `<Badge>` coloreado segun el estatus
- En `fetchPropertyOffers`, agregar el fetch de `id_estatus_aprobacion` del registro de oferta (ya se hace un select adicional de la tabla ofertas en linea ~3100, agregar el campo ahi)
- Buscar el nombre del estatus: hacer join con `estatus_aprobacion` o hacer un lookup local

*Ofertas de productos (dialog linea ~6024):*
- Agregar `<TableHead>Estatus</TableHead>` en el header
- Agregar `<TableCell>` con badge
- En `fetchPropertyProductOffers`, agregar `id_estatus_aprobacion` y join con `estatus_aprobacion` en el select existente

**`src/pages/admin/inmobiliarias/MisPropiedades.tsx`**
- Mismos cambios en los dialogs de ofertas comerciales y productos de esta vista

### Detalle tecnico del badge en PDF (jsPDF)

```
// Despues de dibujar scheme.nombre:
const statusText = estatus_aprobacion_nombre; // ej: "Aprobacion pendiente"
const statusColor = {
  1: { bg: [255, 243, 205], text: [133, 100, 4] },   // amarillo
  2: { bg: [212, 237, 218], text: [21, 87, 36] },     // verde
  3: { bg: [248, 215, 218], text: [114, 28, 36] },    // rojo
  4: { bg: [204, 229, 255], text: [0, 64, 133] },     // azul
};
// Dibujar rectangulo redondeado con texto pequeno
```

### Detalle tecnico del badge en el modal (React)

```typescript
const getEstatusAprobacionBadge = (id: number, nombre: string) => {
  const colors: Record<number, string> = {
    1: "bg-yellow-100 text-yellow-800 border-yellow-300",
    2: "bg-green-100 text-green-800 border-green-300",
    3: "bg-red-100 text-red-800 border-red-300",
    4: "bg-blue-100 text-blue-800 border-blue-300",
  };
  return <Badge variant="outline" className={colors[id]}>{nombre}</Badge>;
};
```

### Resumen de archivos a modificar
1. `src/services/htmlToPdfService.ts` - Fetch estatus y pasar a servicios nativos
2. `src/services/ofertaPdfNativeService.ts` - Dibujar badge en PDF propiedad
3. `src/services/ofertaProductoPdfNativeService.ts` - Dibujar badge en PDF producto
4. `src/services/ofertaPdfStorageService.ts` - Validacion de regeneracion
5. `supabase/functions/generar-oferta-pdf/index.ts` - Badge en edge function
6. `src/pages/admin/Propiedades.tsx` - Columna en ambos modales + fetch del campo
7. `src/pages/admin/inmobiliarias/MisPropiedades.tsx` - Columna en ambos modales + fetch del campo

