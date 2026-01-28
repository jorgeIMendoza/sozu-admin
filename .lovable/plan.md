

# Plan: PDFs de Ofertas con Storage Persistente

## Resumen

Modificar los servicios existentes de generación de PDF para que:
1. Suban el PDF generado al bucket `ofertas` de Supabase Storage
2. Guarden la URL pública en el campo `url` de la tabla `ofertas`
3. Descarguen automáticamente sin abrir nueva ventana
4. Reutilicen PDFs existentes cuando ya tienen URL guardada

## Arquitectura Actual vs Propuesta

```text
ACTUAL:
┌──────────────┐     ┌────────────────────┐     ┌──────────────┐
│ Componente   │────▶│ htmlToPdfService   │────▶│ Native       │
│ (Dialog/Page)│     │ generateOfferPDF() │     │ Service      │
└──────────────┘     └────────────────────┘     │ pdf.save()   │
                                                └──────────────┘
                                                       │
                                                       ▼
                                                ┌──────────────┐
                                                │  Descarga    │
                                                │  directa     │
                                                └──────────────┘

PROPUESTO:
┌──────────────┐     ┌────────────────────┐     ┌──────────────┐
│ Componente   │────▶│ htmlToPdfService   │────▶│ Native       │
│ (Dialog/Page)│     │ generateOfferPDF() │     │ Service      │
└──────────────┘     └────────────────────┘     │ output.blob()│
                                                └──────────────┘
                                                       │
                                                       ▼
                                                ┌──────────────┐
                                                │ Storage      │
                                                │ Service      │
                                                │ (nuevo)      │
                                                └──────────────┘
                                                   │   │   │
                                        ┌──────────┘   │   └──────────┐
                                        ▼             ▼               ▼
                                 ┌──────────┐  ┌──────────┐  ┌──────────┐
                                 │  Subir   │  │ Guardar  │  │ Descargar│
                                 │  bucket  │  │ URL en   │  │ archivo  │
                                 │ "ofertas"│  │   BD     │  │ directo  │
                                 └──────────┘  └──────────┘  └──────────┘
```

## Cambios Técnicos

### 1. Modificar `ofertaPdfNativeService.ts`

Cambiar el método para retornar un Blob en lugar de descargar directamente:

**Antes (línea 936):**
```typescript
pdf.save(filename);
```

**Después:**
```typescript
// Retornar blob y filename
const blob = pdf.output('blob');
return { blob, filename };
```

Cambiar firma del método:
```typescript
// De:
async generateOfferPDF(data: GeneratePDFData): Promise<void>

// A:
async generateOfferPDF(data: GeneratePDFData): Promise<{ blob: Blob; filename: string }>
```

### 2. Modificar `ofertaProductoPdfNativeService.ts`

Mismo cambio que el servicio de propiedades:
```typescript
// Línea 589 - Cambiar de:
pdf.save(filename);

// A:
const blob = pdf.output('blob');
return { blob, filename };
```

### 3. Crear `ofertaPdfStorageService.ts` (NUEVO)

```typescript
import { supabase } from "@/integrations/supabase/client";

interface UploadAndSaveResult {
  url: string;
  filename: string;
}

export class OfertaPdfStorageService {
  
  // Verificar si ya existe URL para una oferta
  async getExistingUrl(offerId: number): Promise<string | null> {
    const { data } = await supabase
      .from('ofertas')
      .select('url')
      .eq('id', offerId)
      .single();
    
    return data?.url || null;
  }

  // Subir blob al bucket y guardar URL en BD
  async uploadAndSave(
    offerId: number, 
    blob: Blob, 
    filename: string,
    isProduct: boolean = false
  ): Promise<UploadAndSaveResult> {
    // Crear path: ofertas/propiedades/O-000123.pdf o ofertas/productos/OP-000123.pdf
    const folder = isProduct ? 'productos' : 'propiedades';
    const path = `${folder}/${filename}`;

    // Subir al bucket
    const { error: uploadError } = await supabase.storage
      .from('ofertas')
      .upload(path, blob, { 
        contentType: 'application/pdf',
        upsert: true 
      });

    if (uploadError) throw uploadError;

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('ofertas')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    // Guardar URL en BD
    const { error: updateError } = await supabase
      .from('ofertas')
      .update({ url: publicUrl })
      .eq('id', offerId);

    if (updateError) throw updateError;

    return { url: publicUrl, filename };
  }

  // Descargar archivo desde URL sin abrir nueva pestaña
  async downloadFromUrl(url: string, filename: string): Promise<void> {
    const response = await fetch(url);
    const blob = await response.blob();
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // Descargar blob directamente
  downloadBlob(blob: Blob, filename: string): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}

export const ofertaPdfStorageService = new OfertaPdfStorageService();
```

### 4. Modificar `htmlToPdfService.ts`

En el método `generateSozuPDF` (línea ~311-324), cambiar para subir y guardar:

```typescript
private async generateSozuPDF(...): Promise<void> {
  // ... código existente para preparar datos ...

  const { ofertaPdfNativeService } = await import('./ofertaPdfNativeService');
  const { ofertaPdfStorageService } = await import('./ofertaPdfStorageService');
  
  // Generar PDF (ahora retorna blob)
  const { blob, filename } = await ofertaPdfNativeService.generateOfferPDF({
    offerData,
    propertyDetails: finalPropertyDetails,
    paymentSchemes,
    creatorInfo,
    leadInfo,
    estacionamientos,
    bodegas,
  });
  
  // Subir a storage y guardar URL
  await ofertaPdfStorageService.uploadAndSave(offerData.id, blob, filename, false);
  
  // Descargar localmente
  ofertaPdfStorageService.downloadBlob(blob, filename);
}
```

Lo mismo para `generateProductPDFFromHTML`.

### 5. Modificar `Propiedades.tsx` - `handleDownloadOffer`

```typescript
const handleDownloadOffer = async (offer: any) => {
  try {
    setDownloadingOfferId(offer.id);
    
    const { ofertaPdfStorageService } = await import('@/services/ofertaPdfStorageService');
    
    // Verificar si ya existe URL
    const existingUrl = await ofertaPdfStorageService.getExistingUrl(offer.id);
    
    if (existingUrl) {
      // Ya tiene PDF, solo descargar
      const filename = existingUrl.split('/').pop() || `oferta-${offer.id}.pdf`;
      await ofertaPdfStorageService.downloadFromUrl(existingUrl, filename);
      
      toast({
        title: "PDF descargado",
        description: "El PDF se ha descargado exitosamente.",
      });
    } else {
      // No tiene PDF, generar nuevo
      toast({
        title: "Generando PDF",
        description: "Preparando la descarga del PDF de la oferta...",
      });
      
      await generateOfferPDF({...});
      
      toast({
        title: "PDF generado",
        description: "El PDF se ha generado y descargado exitosamente.",
      });
    }
  } finally {
    setDownloadingOfferId(null);
  }
};
```

### 6. Modificar `Pagos.tsx` - `handleDownloadOffer`

Misma lógica que Propiedades.tsx.

### 7. Modificar `NewOfferDialog.tsx` y `NewProductOfferDialog.tsx`

Los dialogs no necesitan cambios significativos porque ya llaman a `generateOfferPDF` que internamente ahora manejará el upload y guardado de URL.

## Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/services/ofertaPdfStorageService.ts` | **Crear** | Nuevo servicio para gestión de storage |
| `src/services/ofertaPdfNativeService.ts` | **Modificar** | Retornar blob en lugar de pdf.save() |
| `src/services/ofertaProductoPdfNativeService.ts` | **Modificar** | Retornar blob en lugar de pdf.save() |
| `src/services/htmlToPdfService.ts` | **Modificar** | Integrar upload y guardado de URL |
| `src/pages/admin/Propiedades.tsx` | **Modificar** | Verificar URL existente antes de regenerar |
| `src/pages/admin/Pagos.tsx` | **Modificar** | Verificar URL existente antes de regenerar |

## Estructura en Storage

```text
ofertas/
├── propiedades/
│   ├── O_000001_A101_Proyecto_Uno.pdf
│   ├── O_000002_B205_Proyecto_Dos.pdf
│   └── ...
└── productos/
    ├── OP_000001_A101_Bodega_Proyecto.pdf
    ├── OP_000002_B205_Estac_Proyecto.pdf
    └── ...
```

## Beneficios

1. **URL permanente** - Cada oferta tiene una URL accesible desde cualquier sistema
2. **Sin regeneración innecesaria** - PDFs existentes se reutilizan
3. **Descargas instantáneas** - Las descargas subsecuentes no requieren regeneración
4. **Mantenimiento único** - La lógica de generación sigue en los servicios nativos existentes
5. **Compatible con externos** - La URL puede usarse en n8n, emails, etc.

## Consideraciones

- Los PDFs existentes (sin URL) se generarán al primer download y se guardarán
- El bucket `ofertas` ya existe y es público
- Las URLs serán permanentes a menos que se elimine el archivo del bucket
- Si se necesita regenerar un PDF (por cambios), se puede hacer upsert sobre el archivo existente

