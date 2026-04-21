

## Agregar columna "Evidencia" en Rastreo de Pagos STP

### Objetivo
En la tabla de Rastreo de Pagos STP (`/admin/rastreo-pagos-stp`), agregar una nueva columna **Evidencia** que muestre el CEP/Recibo de cada pago y permita previsualizarlo en un modal.

### Comportamiento

Para cada fila se buscará en la tabla `pagos` (uniendo por `clave_rastreo = pagos_stp_raw.claverastreo`) el primer pago coincidente:

1. **Si `url_cep` no es null/vacío** → mostrar botón con ícono de ojito 👁 que abre el PDF de `url_cep`.
2. **Si `url_cep` está vacío pero `url_recibo` no** → mostrar el botón de ojito que abre el PDF de `url_recibo`.
3. **Si ambos están null/vacíos** → mostrar la leyenda **"Aún sin CEP"** en texto tenue (sin botón).
4. **Si no existe registro en `pagos`** (el pago STP aún no fue conciliado) → mostrar también **"Aún sin CEP"**.

### Cambios técnicos

**Archivo:** `src/pages/admin/RastreoPagosSTP.tsx`

1. **Extender el query** después de obtener `pagos_stp_raw`:
   - Tomar el listado de `claverastreo` resultante.
   - Hacer un `select` adicional a `pagos` filtrando por `clave_rastreo IN (...)` trayendo `clave_rastreo, url_cep, url_recibo`.
   - Construir un mapa `claveRastreo → { url_cep, url_recibo }` y enriquecer cada `PagoSTP` con un campo `evidencia_url: string | null`.

2. **Agregar columna en la tabla**:
   - Header `<TableHead>Evidencia</TableHead>` (al final, después de "Tipo de Pago").
   - En cada fila: si `evidencia_url` existe, renderizar un botón `Eye` que abre `PdfViewerDialog`. Si no, mostrar `<span className="text-xs text-muted-foreground italic">Aún sin CEP</span>`.

3. **Modal de preview**: usar el componente existente `PdfViewerDialog` (`src/components/admin/PdfViewerDialog.tsx`) que ya maneja URLs públicas y firmadas de Supabase Storage. Estado local: `const [evidenciaUrl, setEvidenciaUrl] = useState<string | null>(null)`.

4. **Actualizar `colSpan`** de los estados "Cargando" y "Sin resultados" de `11` → `12`.

### Notas
- No requiere migraciones ni cambios en RLS (ya hay acceso de lectura a `pagos` desde el panel admin).
- Si el pago STP es de tipo Comisión (no genera CEP en el flujo actual), simplemente caerá en el caso "Aún sin CEP".
- Reutilizamos completamente `PdfViewerDialog`, sin crear componentes nuevos.

