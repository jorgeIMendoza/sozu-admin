

## Plan: Crear Edge Function `generar-estado-cuenta`

### Objetivo
Crear una Edge Function que genere estados de cuenta de cobranza como PDF via API, replicando la logica completa de `src/services/estadoCuentaService.ts` pero usando `pdf-lib` en el servidor (mismo patron que `generar-recibo-pago`).

### Uso externo (Postman, n8n, etc.)
```
POST https://tzmhgfjmddkfyffkkmto.supabase.co/functions/v1/generar-estado-cuenta
Content-Type: application/json

Body: { "id_cuenta": 193 }

Response: {
  "success": true,
  "url_estado_cuenta": "https://...publicUrl...",
  "fileName": "estado_cuenta_CC-000193_2026_02_10.pdf",
  "expiresIn": "1 minute",
  "id_cuenta": 193
}
```

### Archivos a crear/modificar

**1. `supabase/functions/generar-estado-cuenta/index.ts`** (nuevo)

Edge Function que:
- Recibe `{ id_cuenta }` en el body
- Usa `SUPABASE_SERVICE_ROLE_KEY` para queries (mismo patron que generar-recibo-pago)
- Replica las mismas queries de datos del servicio frontend:
  - `cuentas_cobranza` -> `ofertas` -> `propiedad` o `producto`
  - `compradores` con `personas`
  - `acuerdos_pago` con `conceptos_pago`
  - `multas` a traves de acuerdos
  - `pagos` con `metodos_pago` y `aplicaciones_pago`
  - `esquemas_pago` para info del contrato
  - `edificios_modelos` -> `edificios` -> `proyectos`
  - `estacionamientos` y `bodegas`
  - `productos_servicios` con `categorias_producto`
- Calcula totales: `precioFinal`, `totalPagado` (de aplicaciones no-multa), `totalMultas`, `saldoPendiente`
- Genera PDF con `pdf-lib` replicando el layout:
  - Header con nombre del proyecto y numero de cuenta
  - Nombre del cliente (compradores) y RFC/CURP
  - CLABE STP si existe
  - Seccion "Detalles del Inmueble/Producto" (izquierda) con proyecto, torre, nivel, modelo, propiedad, estacionamientos, bodegas
  - Seccion "Informacion del contrato" (derecha) con fecha compra, parcialidades, pago mensual, apartado, enganche, contraentrega
  - 4 tarjetas resumen: Precio Final, Total Pagado, Multas, Saldo Pendiente
  - Tabla "Acuerdos de Pago" con columnas: #, Concepto, Fecha, Monto, Pagado, Pendiente, Estado
  - Tabla "Multas" (si existen) con descripciones multi-linea
  - Tabla "Pagos Realizados" con fecha, metodo, referencia, monto y total
  - Footer con notas
  - Soporte multi-pagina (checkNewPage)
- Sube PDF a storage `documentos/estados_cuenta_temp/` con TTL de 1 minuto
- Retorna URL publica del PDF

**2. `supabase/config.toml`** (modificar)

Agregar:
```toml
[functions.generar-estado-cuenta]
verify_jwt = false
```

### Detalles tecnicos

- **Dependencias**: `pdf-lib@1.17.1` via esm.sh (igual que generar-recibo-pago)
- **Fonts**: `Helvetica` y `HelveticaBold` (StandardFonts de pdf-lib)
- **Tamano pagina**: A4 (595.28 x 841.89 pts) o Letter (612 x 792 pts) - usaremos Letter para consistencia con recibo
- **Layout PDF con pdf-lib**: Coordenadas Y van de abajo hacia arriba (invertido vs jsPDF). Se traduce toda la logica de posicionamiento
- **Helpers reutilizados del recibo**: `formatMoney`, `formatDate`, `wrapText`, `drawCenteredText`, `formatCuentaCobranzaId`
- **Multi-pagina**: Funcion `checkNewPage` que agrega pagina cuando `yPosition < margin` y resetea Y
- **Almacenamiento temporal**: Sube a `documentos/estados_cuenta_temp/`, se auto-elimina en 1 minuto via `setTimeout`
- **CORS**: Headers estandar para llamadas desde web y externas
- **Sin autenticacion**: `verify_jwt = false` para acceso desde n8n/Postman (consistente con las demas funciones del proyecto)

### Diferencias clave jsPDF vs pdf-lib
- jsPDF: Y crece hacia abajo, coordenadas en mm
- pdf-lib: Y crece hacia arriba, coordenadas en pts (1mm = 2.835pts)
- jsPDF `roundedRect` -> pdf-lib `drawRectangle` con `borderRadius` (no soportado nativo, se usa rectangulos simples)
- jsPDF `text(align: "right")` -> pdf-lib calcula `x - font.widthOfTextAtSize(text, size)`
- Colores: jsPDF hex strings -> pdf-lib `rgb(r, g, b)` con valores 0-1

