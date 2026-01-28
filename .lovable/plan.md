

# Crear ZIP Descargable del Paquete PDF

## Resumen
Crear una página o componente que permita descargar un archivo ZIP con todos los archivos necesarios para implementar la generación de PDFs de ofertas en otro proyecto Lovable.

## Contenido del ZIP

El paquete incluirá **10 archivos** organizados en carpetas:

```text
paquete-pdf-ofertas/
├── README.md                           (documentación)
├── services/
│   ├── ofertaPdfNativeService.ts       (ofertas de propiedades)
│   └── ofertaProductoPdfNativeService.ts (ofertas de productos)
├── utils/
│   └── fiscalDataValidation.ts         (validación de RFC)
└── assets/
    └── icons/
        ├── balcon.png
        ├── banos.png
        ├── bodega.png
        ├── estacionamiento.png
        ├── medios-banos.png
        └── recamaras.png
```

## Implementación

### Paso 1: Crear página de descarga
Crear una nueva página `/admin/descargar-paquete-pdf` que:
- Muestre información del contenido del paquete
- Tenga un botón "Descargar ZIP"
- Use la librería **JSZip** (ya instalada en el proyecto) para generar el ZIP en el navegador

### Paso 2: Lógica de generación del ZIP
El componente:
1. Descargará cada archivo desde las URLs públicas (`/despia/paquete-pdf-ofertas/...`)
2. Los agregará al ZIP manteniendo la estructura de carpetas
3. Generará el archivo `paquete-pdf-ofertas.zip` y lo descargará automáticamente

### Paso 3: Agregar acceso a la página
Agregar un enlace en el menú de administración o en algún lugar accesible para llegar a esta página de descarga.

## Detalles Técnicos

### Uso de JSZip
```typescript
import JSZip from 'jszip';

const zip = new JSZip();

// Agregar archivos de texto
const readmeContent = await fetch('/despia/paquete-pdf-ofertas/README.md').then(r => r.text());
zip.file('README.md', readmeContent);

// Agregar archivos binarios (imágenes)
const iconBlob = await fetch('/despia/paquete-pdf-ofertas/assets/icons/recamaras.png').then(r => r.blob());
zip.file('assets/icons/recamaras.png', iconBlob);

// Generar y descargar
const content = await zip.generateAsync({ type: 'blob' });
saveAs(content, 'paquete-pdf-ofertas.zip');
```

### Archivos a incluir
| Ruta en ZIP | URL de origen |
|-------------|---------------|
| `README.md` | `/despia/paquete-pdf-ofertas/README.md` |
| `services/ofertaPdfNativeService.ts` | `/despia/paquete-pdf-ofertas/services/ofertaPdfNativeService.ts` |
| `services/ofertaProductoPdfNativeService.ts` | `/despia/paquete-pdf-ofertas/services/ofertaProductoPdfNativeService.ts` |
| `utils/fiscalDataValidation.ts` | `/despia/paquete-pdf-ofertas/utils/fiscalDataValidation.ts` |
| `assets/icons/balcon.png` | `/despia/paquete-pdf-ofertas/assets/icons/balcon.png` |
| `assets/icons/banos.png` | `/despia/paquete-pdf-ofertas/assets/icons/banos.png` |
| `assets/icons/bodega.png` | `/despia/paquete-pdf-ofertas/assets/icons/bodega.png` |
| `assets/icons/estacionamiento.png` | `/despia/paquete-pdf-ofertas/assets/icons/estacionamiento.png` |
| `assets/icons/medios-banos.png` | `/despia/paquete-pdf-ofertas/assets/icons/medios-banos.png` |
| `assets/icons/recamaras.png` | `/despia/paquete-pdf-ofertas/assets/icons/recamaras.png` |

## Resultado Final

Una página simple con:
- Título: "Descargar Paquete PDF de Ofertas"
- Lista de archivos incluidos
- Botón grande "Descargar ZIP" que genera y descarga `paquete-pdf-ofertas.zip`
- Instrucciones básicas de instalación

