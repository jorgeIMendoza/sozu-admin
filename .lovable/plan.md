

## Problema

La descarga de PDF de **ofertas de productos** (en el diálogo de "Ofertas de Productos" de Propiedades) siempre regenera el PDF sin verificar si ya existe una URL guardada. En cambio, las **ofertas de propiedades** sí tienen esta lógica correcta: primero revisan si hay URL, validan los datos, y solo regeneran si es necesario.

Adicionalmente, hay un bug en la validación de `ofertaPdfStorageService.ts` que **siempre invalida** los PDFs cuando la oferta tiene esquema de pago seleccionado + estatus de aprobación (linea 173), lo que causa regeneraciones innecesarias en ambos flujos.

## Solución

### 1. Agregar lógica de caché al botón de descarga de ofertas de productos

**Archivo:** `src/pages/admin/Propiedades.tsx` (lineas ~6496-6530)

Replicar el mismo patrón que ya usa `handleDownloadOffer` (linea 1056) para propiedades:

```text
Flujo actual (productos):
  Click → generateOfferPDF() → siempre regenera

Flujo corregido (igual que propiedades):
  Click → getExistingUrl()
    → Si existe URL → validateOfferDataAndInvalidateIfNeeded()
      → Si es válida → downloadFromUrl() (descarga directa, rápida)
      → Si fue invalidada → generateOfferPDF() (regenera)
    → Si no existe URL → generateOfferPDF() (genera por primera vez)
```

### 2. Corregir la validación que siempre invalida con estatus de aprobación

**Archivo:** `src/services/ofertaPdfStorageService.ts` (linea ~170-175)

El Caso 3 actual dice: "si hay esquema + estatus de aprobación, invalidar siempre". Esto causa que **toda oferta aprobada** se regenere cada vez.

La corrección: eliminar este caso, ya que el badge de estatus ya se incluye en la generación actual del PDF. Si se necesita regenerar por un cambio de estatus, eso debería manejarse con un mecanismo explícito (setear `url = null` cuando cambia el estatus), no invalidando siempre.

### 3. Invalidación explícita al cambiar estatus de aprobación

**Archivo:** `src/pages/admin/Propiedades.tsx`

Cuando se cambia el `id_estatus_aprobacion` de una oferta (via `CambiarEstatusAprobacionDialog`), se debe limpiar la URL del PDF para forzar regeneración en la próxima descarga. Esto reemplaza la invalidación automática del Caso 3.

## Resumen de archivos a modificar

1. **`src/pages/admin/Propiedades.tsx`** - Agregar verificación de URL existente al descargar ofertas de productos (lineas ~6496-6530), y limpiar URL al cambiar estatus de aprobación
2. **`src/services/ofertaPdfStorageService.ts`** - Eliminar Caso 3 que siempre invalida cuando hay esquema + estatus

