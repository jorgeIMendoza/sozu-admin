
# Paquete de Generación de PDFs de Ofertas

## Descripción General
Este paquete contiene todos los archivos necesarios para generar PDFs de ofertas de propiedades y productos exactamente como se generan en el sistema actual. Utiliza **jsPDF** para generación nativa en el navegador.

## Archivos Incluidos

### 1. Servicios Principales

| Archivo | Descripción | Líneas |
|---------|-------------|--------|
| `ofertaPdfNativeService.ts` | Genera PDFs de ofertas de **propiedades** | 990 |
| `ofertaProductoPdfNativeService.ts` | Genera PDFs de ofertas de **productos** | 430 |
| `fiscalDataValidation.ts` | Utilidad para validar RFC (requerida) | 95 |

### 2. Iconos PNG (6 archivos)
Ubicación original: `src/assets/icons/`

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

```json
{
  "dependencies": {
    "jspdf": "^3.0.3"
  }
}
```

## Cambios Necesarios en los Imports

Los archivos originales usan alias `@/` de Vite/TypeScript. Deberás ajustar los imports según tu proyecto:

### ofertaPdfNativeService.ts
```typescript
// Cambiar de:
import { isValidRFC } from "@/utils/fiscalDataValidation";
import recamarasIcon from "@/assets/icons/recamaras.png";
import banosIcon from "@/assets/icons/banos.png";
// ... etc

// A (rutas relativas):
import { isValidRFC } from "../utils/fiscalDataValidation";
import recamarasIcon from "../assets/icons/recamaras.png";
import banosIcon from "../assets/icons/banos.png";
// ... etc
```

### ofertaProductoPdfNativeService.ts
Este archivo no tiene dependencias adicionales, solo usa jsPDF.

## Cómo Usar los Servicios

### Para Ofertas de Propiedades

```typescript
import { ofertaPdfNativeService } from './services/ofertaPdfNativeService';

// Preparar los datos
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
    // ... más campos
  },
  paymentSchemes: [...],
  creatorInfo: {...},
  leadInfo: {...},
  estacionamientos: [...],
  bodegas: [...],
};

// Generar y descargar el PDF
await ofertaPdfNativeService.generateOfferPDF(data);
```

### Para Ofertas de Productos

```typescript
import { ofertaProductoPdfNativeService } from './services/ofertaProductoPdfNativeService';

const data = {
  offerData: {...},
  propertyDetails: {...},
  productDetails: {
    id: 1,
    nombre: 'Cocina Integral',
    precio_lista: 250000,
    // ... más campos
  },
  paymentSchemes: [...],
  creatorInfo: {...},
  leadInfo: {...},
  legalNotices: [...],
};

await ofertaProductoPdfNativeService.generateOfferPDF(data);
```

## Interfaces de Datos

### PropertyDetails (Propiedades)
```typescript
interface PropertyDetails {
  id: number;
  numero_propiedad: string;
  precio_lista: number;
  m2_interiores: number | null;
  m2_exteriores: number | null;
  descripcion: string | null;
  numero_piso?: string | null;
  clabe_stp_tmp_apartado?: string | null;
  tieneBalcon?: boolean;
  building?: { id: number; nombre: string; };
  model?: {
    id: number;
    nombre: string;
    numero_recamaras: number | null;
    numero_completo_banos: number | null;
    numero_medio_bano: number | null;
  };
  vista?: { id: number; nombre: string; };
  projectData?: {
    id: number;
    nombre: string;
    url_logo?: string;
    mostrar_precio_m2_en_oferta?: boolean;
    mostrar_piso_en_oferta?: boolean;
    mostrar_seccion_efectivo_en_oferta?: boolean;
  };
  ownerData?: { nombre_legal: string; };
  ownerStpBankAccount?: {
    numero_cuenta: string;
    cuenta_clabe: string;
    banco_nombre: string;
  };
  modelImages?: Array<{ url: string; ver_como_ubicacion_en_oferta: boolean; }>;
}
```

### PaymentScheme (Esquemas de Pago)
```typescript
interface PaymentScheme {
  id: number;
  nombre: string;
  porcentaje_enganche: number;
  numero_mensualidades: number;
  numero_pagos_enganche: number;
  porcentaje_mensualidades: number;
  porcentaje_entrega: number;
  porcentaje_descuento_aumento: number;
  es_manual: boolean;
  tramos_mensualidad?: Array<{
    orden: number;
    numero_mensualidades: number;
    monto: number;
  }> | null;
}
```

## Notas Importantes

1. **Entorno de Ejecución**: Estos servicios requieren un entorno de navegador porque usan:
   - `new Image()` para cargar imágenes
   - `document.createElement('canvas')` para convertir imágenes a base64
   - `pdf.save()` para descargar el PDF

2. **Configuración de Vite/TypeScript**: Si usas el alias `@/`, asegúrate de tenerlo configurado en:
   - `vite.config.ts` o `tsconfig.json`
   
3. **CORS para Imágenes**: Si las imágenes vienen de URLs externas, el servidor debe permitir CORS con `Access-Control-Allow-Origin`.

4. **Características del PDF**:
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
4. Ajustar los imports según la configuración de tu proyecto
5. Preparar los datos desde tu base de datos (Supabase u otra)
6. Llamar a `generateOfferPDF(data)` cuando el usuario presione el botón de generar/descargar
