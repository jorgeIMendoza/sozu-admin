

## Problema

La funcion `getOrCreateProductClabe` en `clabeReuseUtils.ts` tiene un patron destructivo: limpia las CLABEs de ofertas existentes **antes** de que el llamador guarde la CLABE en la nueva oferta. Si algo falla despues de limpiar, la CLABE se pierde permanentemente (como paso con la oferta 1791).

## Solucion

### 1. Refactorizar `clabeReuseUtils.ts` - Patron no destructivo

Cambiar la funcion para que **no limpie CLABEs directamente**. En su lugar, retornara un objeto con la CLABE y el ID de la oferta fuente:

```text
Antes:  getOrCreateProductClabe() -> string (y limpia CLABEs internamente)
Ahora:  getOrCreateProductClabe() -> { clabe: string, sourceOfferIds: number[] }
```

La funcion dejara de hacer el `UPDATE ... SET clabe_stp_tmp_producto = NULL`. Solo buscara y retornara la informacion.

El llamador sera responsable de:
1. Guardar la CLABE en la nueva oferta
2. Solo despues de exito, limpiar la CLABE de las ofertas fuente

### 2. Actualizar los 3 llamadores

**a) `NewProductOfferDialog.tsx` (linea ~624)**
- Recibir `{ clabe, sourceOfferIds }`
- Usar `clabe` al crear la oferta
- Despues de crear exitosamente, limpiar CLABEs de `sourceOfferIds`

**b) `NewOfferDialog.tsx` (linea ~862)**
- Mismo patron: crear oferta primero, limpiar despues

**c) `Propiedades.tsx` (linea ~6314)**
- Mismo patron: actualizar oferta con esquema y CLABE, luego limpiar fuentes

### 3. Recuperar CLABE de oferta 1791

Generar una nueva CLABE via `crear_referencia_bancaria` y asignarla a la oferta 1791 directamente desde la consola SQL o mediante una accion manual en el sistema.

## Detalle tecnico

### Nuevo tipo de retorno de `getOrCreateProductClabe`:

```typescript
interface ClabeResult {
  clabe: string;
  sourceOfferIds: number[];  // IDs de ofertas a limpiar (vacio si se genero nueva)
  isNew: boolean;            // true si se genero nueva CLABE
}
```

### Logica en cada llamador (ejemplo):

```typescript
const result = await getOrCreateProductClabe(propId, prodId, idErDueno);

// 1. Crear/actualizar oferta con la CLABE
const { error } = await supabase.from('ofertas').insert({
  ...datos,
  clabe_stp_tmp_producto: result.clabe
});

if (error) throw error; // La CLABE original sigue intacta

// 2. Solo si la oferta se creo bien, limpiar fuentes
if (result.sourceOfferIds.length > 0) {
  await supabase.from('ofertas')
    .update({ clabe_stp_tmp_producto: null })
    .in('id', result.sourceOfferIds);
}
```

### Archivos a modificar:
1. `src/utils/clabeReuseUtils.ts` - Refactorizar retorno
2. `src/components/admin/NewProductOfferDialog.tsx` - Actualizar llamada
3. `src/components/admin/NewOfferDialog.tsx` - Actualizar llamada
4. `src/pages/admin/Propiedades.tsx` - Actualizar llamada

