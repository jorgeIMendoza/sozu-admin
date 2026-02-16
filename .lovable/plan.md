

## Plan: Preview modal, regenerar, y revisar payload

### 1. Preview modal para factura Draft

En la tabla de Comisiones (`src/pages/admin/Comisiones.tsx`), cuando una factura tiene estatus "Draft":
- Agregar un boton de "ojo" (Eye icon) junto al badge Draft que abra un Dialog/modal
- El modal mostrara un iframe con la URL del documento (`factura_sozu_doc.url`)
- Titulo del modal: "Preview Factura Comision Sozu"

### 2. Opcion de Regenerar

Junto al badge "Draft", agregar un boton con icono RefreshCw que llame a `handleGenerarFactura` con el mismo `cuentaId`, permitiendo regenerar el draft.

### 3. Revisar payload de factura de propiedad

El payload actual que envia `FacturasTab.tsx` al endpoint `/generaFactura` para facturas de propiedad es:

```text
{
  api_key: <api_key_draft o nombre_api_key>,
  environment: <"development" | "production">,
  tipo_factura: "propiedad",
  id_propiedad: number,
  id_cuenta_cobranza: number,
  id_documento: number (opcional, si ya existe),
  es_draft: boolean,
  id_estatus_verificacion: 1 (Pendiente) | 2 (Validado),
  propiedad: {
    numero_propiedad: string,
    metraje_escriturable: number (m2_interiores + m2_exteriores),
    direccion: string (del proyecto),
    precio_final: number,
    piso: string
  },
  estacionamientos: [{
    nombre, tipo, m2, ubicacion, es_incluido
  }],
  bodegas: [{
    nombre, m2, ubicacion, es_incluido
  }],
  escrituracion: {
    numero_escritura, fecha_escritura, libro, hoja,
    clave_catastral, numero_unidad_privativa,
    notario: { nombre, notaria, direccion, email, telefono }
  },
  compradores: [{
    id_persona, nombre_completo, porcentaje_propiedad,
    email, telefono, rfc, curp, regimen, uso_cfdi,
    direccion_fiscal: {
      calle, numero_exterior, numero_interior,
      colonia, codigo_postal, municipio, estado, pais
    }
  }]
}
```

Actualmente, `generar-factura-comision-sozu` envia solo `{ tipo_factura: "comision" }`. 
Una vez que apruebes este plan, implementare el modal y el boton de regenerar. Ademas, te presentare el payload actual para que me indiques que campos debe llevar el payload de comision.

### Detalle tecnico

**Archivo: `src/pages/admin/Comisiones.tsx`**

- Agregar estado para el modal de preview: `previewDialog` con `isOpen`, `url`, `title`
- En la seccion de Draft (lineas 645-657), agregar botones de Eye (preview) y RefreshCw (regenerar)
- Agregar un Dialog al final del componente con un iframe para mostrar el PDF
- Importar `RefreshCw` de lucide-react

