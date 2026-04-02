
## Cambios requeridos

### 1. Interface y UI de Tramos (`TramosEscalonadosSection.tsx`)
- Agregar `fecha_limite?: string` al interface `Tramo`
- Agregar input de fecha opcional por tramo (al lado del monto fijo)
- Nota: cuando tiene fecha, el num de mensualidades se calcula dinámicamente al generar oferta

### 2. Detalle de esquemas (`PaymentSchemeManagement.tsx`)
- Si el esquema tiene tramos con `monto_mensualidad`, el detalle solo muestra:
  - **Enganche: X%**
  - **Monto mensual: $X/mes** (y fecha límite si existe)
- **Ocultar**: % mensualidades, % entrega, No. mensualidades, sección de tramos escalonados

### 3. PDF Template (`OfferPDFTemplate.tsx`)
- Para esquemas con tramos+monto_fijo: mostrar solo enganche + monto mensual + contra-entrega calculado (sin porcentajes de mensualidades/entrega)

### 4. PDF Template Sozu (`OfferPDFTemplateSozu.tsx`)
- Misma lógica que el template anterior

### 5. Edge Function PDF (`generar-oferta-pdf/index.ts`)
- Misma lógica en ambas secciones de PDF (propiedad y productos)

### 6. Dialogs (`NewPaymentSchemeDialog.tsx`, `EditPaymentSchemeDialog.tsx`)
- Cargar/guardar `fecha_limite` en los tramos
