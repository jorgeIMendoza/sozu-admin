# Paquete de Generación de PDFs de Ofertas

## Descripción General
Este paquete contiene todos los archivos necesarios para generar PDFs de ofertas de propiedades y productos exactamente como se generan en el sistema actual. Utiliza **jsPDF** para generación nativa en el navegador.

## Archivos Incluidos

### 1. Servicios Principales

| Archivo | Descripción | Líneas |
|---------|-------------|--------|
| `ofertaPdfNativeService.ts` | Genera PDFs de ofertas de **propiedades** | 990 |
| `ofertaProductoPdfNativeService.ts` | Genera PDFs de ofertas de **productos** | 594 |
| `fiscalDataValidation.ts` | Utilidad para validar RFC (requerida) | 133 |

### 2. Iconos PNG (6 archivos)
Ubicación: `assets/icons/`

- `recamaras.png` - Icono de recámaras
- `banos.png` - Icono de baños completos
- `medios-banos.png` - Icono de medios baños
- `estacionamiento.png` - Icono de estacionamientos
- `bodega.png` - Icono de bodegas
- `balcon.png` - Icono de balcón

## Estructura de Carpetas Recomendada

```text
src/
├── assets/
│   └── icons/
│       ├── balcon.png
│       ├── banos.png
│       ├── bodega.png
│       ├── estacionamiento.png
│       ├── medios-banos.png
│       └── recamaras.png
├── services/
│   ├── ofertaPdfNativeService.ts
│   └── ofertaProductoPdfNativeService.ts
└── utils/
    └── fiscalDataValidation.ts
```

## Dependencias NPM Requeridas

```bash
npm install jspdf
```

o si usas bun:

```bash
bun add jspdf
```

## Configuración de Alias (Opcional)

Si tu proyecto usa el alias `@/` para imports, asegúrate de tenerlo configurado. Los archivos de este paquete ya usan el alias `@/`.

### vite.config.ts
```typescript
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Cómo Usar los Servicios

### Para Ofertas de Propiedades

```typescript
import { ofertaPdfNativeService } from '@/services/ofertaPdfNativeService';

const data = {
  offerData: {
    id: 123,
    fecha_generacion: '2025-01-28',
    propertyNumber: 'A-101',
    leadName: 'Juan Pérez',
    leadEmail: 'juan@ejemplo.com',
    email_creador: 'agente@empresa.com',
    id_esquema_pago_seleccionado: 5,
  },
  propertyDetails: {
    id: 1,
    numero_propiedad: 'A-101',
    precio_lista: 5000000,
    m2_interiores: 120,
    m2_exteriores: 15,
    descripcion: 'Departamento de lujo',
    building: { id: 1, nombre: 'Torre A' },
    model: {
      id: 1,
      nombre: 'Penthouse',
      numero_recamaras: 3,
      numero_completo_banos: 2,
      numero_medio_bano: 1,
    },
    projectData: {
      id: 1,
      nombre: 'Residencial Elite',
      url_logo: 'https://example.com/logo.png',
    },
  },
  paymentSchemes: [
    {
      id: 1,
      nombre: 'Contado',
      porcentaje_enganche: 100,
      numero_mensualidades: 0,
      numero_pagos_enganche: 1,
      porcentaje_mensualidades: 0,
      porcentaje_entrega: 0,
      porcentaje_descuento_aumento: -5,
      es_manual: false,
    },
  ],
  creatorInfo: {
    nombre_legal: 'Carlos López',
    email: 'carlos@inmobiliaria.com',
    telefono: '555-1234',
  },
  leadInfo: {
    nombre_legal: 'Juan Pérez',
    email: 'juan@ejemplo.com',
    telefono: '555-5678',
    rfc: 'PEPJ800101ABC',
  },
  estacionamientos: [],
  bodegas: [],
};

// Genera y descarga el PDF automáticamente
await ofertaPdfNativeService.generateOfferPDF(data);
```

### Para Ofertas de Productos

```typescript
import { ofertaProductoPdfNativeService } from '@/services/ofertaProductoPdfNativeService';

const data = {
  offerData: {
    id: 456,
    fecha_generacion: '2025-01-28',
    propertyNumber: 'A-101',
    leadName: 'María García',
    leadEmail: 'maria@ejemplo.com',
    email_creador: 'agente@empresa.com',
    id_esquema_pago_seleccionado: 10,
    clabe_stp_tmp_producto: '646180123456789012',
  },
  propertyDetails: {
    id: 1,
    numero_propiedad: 'A-101',
    projectData: {
      id: 1,
      nombre: 'Residencial Elite',
      url_logo: 'https://example.com/logo.png',
    },
  },
  productDetails: {
    id: 1,
    nombre: 'Cocina Integral Premium',
    precio_lista: 250000,
    categoria_nombre: 'Cocinas',
    ownerData: {
      id: 1,
      nombre_legal: 'Desarrollos SA de CV',
      email: 'info@desarrollos.com',
      telefono: '555-0000',
    },
  },
  paymentSchemes: [
    {
      id: 10,
      nombre: 'Financiamiento 12 meses',
      porcentaje_enganche: 30,
      numero_mensualidades: 12,
      porcentaje_mensualidades: 70,
      porcentaje_entrega: 0,
      porcentaje_descuento_aumento: 0,
      es_manual: false,
    },
  ],
  creatorInfo: {
    nombre_legal: 'Carlos López',
    email: 'carlos@inmobiliaria.com',
    telefono: '555-1234',
  },
  leadInfo: {
    nombre_legal: 'María García',
    email: 'maria@ejemplo.com',
    telefono: '555-9876',
    rfc: 'GAGM900202XYZ',
  },
  legalNotices: [
    'Los precios están sujetos a cambio sin previo aviso.',
    'Consulte términos y condiciones.',
  ],
};

await ofertaProductoPdfNativeService.generateOfferPDF(data);
```

## Notas Importantes

1. **Entorno de Ejecución**: Estos servicios requieren un entorno de navegador porque usan:
   - `new Image()` para cargar imágenes
   - `document.createElement('canvas')` para convertir imágenes a base64
   - `pdf.save()` para descargar el PDF

2. **CORS para Imágenes**: Si las imágenes (logos, fotos de modelos) vienen de URLs externas, el servidor debe permitir CORS.

3. **Características del PDF**:
   - Formato A4 vertical
   - Logo del proyecto en la esquina superior izquierda
   - Imagen del modelo en la sección de datos
   - Iconos para recámaras, baños, estacionamientos, etc.
   - Esquemas de pago con tarjetas (el seleccionado resaltado en verde)
   - Datos bancarios para transferencia y efectivo
   - Datos de contacto del agente y comprador

## Pasos de Implementación

1. Instalar dependencia: `npm install jspdf`
2. Copiar los 3 archivos TypeScript a las ubicaciones correspondientes
3. Copiar los 6 iconos PNG a `src/assets/icons/`
4. Configurar el alias `@/` si no lo tienes
5. Preparar los datos desde tu base de datos
6. Llamar a `generateOfferPDF(data)` cuando el usuario presione el botón
