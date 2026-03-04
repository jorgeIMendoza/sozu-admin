
## Plan: Centrar firmas sobre la línea en todos los firmantes

### Problema
La firma actual usa `left-12` que la posiciona con un offset fijo. El usuario quiere que cada firma quede centrada exactamente sobre la porción de línea "___________________________" (después del texto "Firma:").

### Cambios

**1. `src/components/admin/CartaAcuerdoDetalle.tsx` (líneas 370-378)**
- Cambiar la estructura para que la imagen de firma se centre sobre la línea de guiones bajos
- Separar "Firma:" del trazo "___________________________" en elementos distintos
- Posicionar la imagen centrada horizontalmente sobre los guiones bajos usando un contenedor relativo solo para la línea + firma

Estructura propuesta:
```
<div className="flex items-end gap-1 my-2">
  <span>Firma:</span>
  <div className="relative flex-1">
    {firma_imagen && (
      <img className="absolute left-1/2 -translate-x-1/2 bottom-1 h-32 max-w-[260px] object-contain" />
    )}
    <span>___________________________</span>
  </div>
</div>
```

Esto centra la imagen respecto a la línea de guiones (no respecto a "Firma:"), manteniendo el tamaño `h-32` ya aprobado.

**2. Aplicar el mismo patrón al bloque "EL AGENTE"** (líneas 387-389) para consistencia.

**3. `src/components/admin/TemplateEditorWithPreview.tsx` (líneas 72-76)**
- Actualizar el HTML inline de firmas en el iframe preview con la misma lógica: separar "Firma:" de la línea y centrar la imagen sobre los guiones.
