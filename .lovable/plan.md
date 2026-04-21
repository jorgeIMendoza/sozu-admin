

## Verificar invalidación del PDF al reciclar CLABE en oferta de producto

### Pregunta
Cuando se recicla la CLABE de la oferta 1798 hacia la nueva oferta de producto, ¿se está limpiando la URL del PDF de la oferta 1798 para que se regenere cuando se requiera?

### Hallazgos

**1. `clearSourceOfferClabes` (src/utils/clabeReuseUtils.ts):**
Solo hace `UPDATE ofertas SET clabe_stp_tmp_producto = NULL`. **NO toca la columna `url`**, por lo que el PDF de la oferta 1798 conserva su link aunque la CLABE que está impresa adentro ya no le pertenezca.

**2. `OfertaPdfStorageService.validateCriticalData` (src/services/ofertaPdfStorageService.ts):**
La validación de invalidación lee `clabe_stp_tmp_apartado` de la propiedad — **NO valida `clabe_stp_tmp_producto` de la oferta**. Para ofertas de producto, el cambio de CLABE pasa desapercibido y el PDF viejo se sigue sirviendo.

**3. Resultado actual:**
Si alguien descarga el PDF de la oferta 1798 después de que su CLABE fue reciclada, verá una CLABE incorrecta (la que ahora pertenece a la nueva oferta). El link no se invalida automáticamente.

### Cambio propuesto

**Archivo:** `src/utils/clabeReuseUtils.ts` — función `clearSourceOfferClabes`

Extender el `UPDATE` para también limpiar `url` en las ofertas fuente:

```text
Antes:
  UPDATE ofertas
  SET clabe_stp_tmp_producto = NULL
  WHERE id IN (sourceOfferIds)

Después:
  UPDATE ofertas
  SET clabe_stp_tmp_producto = NULL,
      url = NULL
  WHERE id IN (sourceOfferIds)
```

Con esto, la próxima vez que alguien intente descargar el PDF de la oferta fuente, `getExistingUrl` devolverá `null` y el sistema regenerará el PDF con los datos actuales (sin la CLABE que ya fue reasignada).

### Notas

- El cambio es independiente del fix previo (mover `clearSourceOfferClabes` antes del INSERT en `NewProductOfferDialog.tsx`). Ambos se aplican en la misma intervención.
- No requiere migración de BD ni cambios de RLS.
- No afecta a las ofertas que conservan su CLABE — solo a las que la ceden.
- La regeneración del PDF es bajo demanda (cuando se descarga), no se dispara automáticamente.

