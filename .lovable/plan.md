
## Plan: Corregir error de descarga de PDF de ofertas

### Problema
Al intentar descargar el PDF de la oferta O-001759, el metodo `downloadFromUrl` en `ofertaPdfStorageService.ts` hace un `fetch(url)` directo a la URL publica de Supabase Storage. Esto puede fallar por restricciones CORS del navegador cuando la app corre en el dominio de Lovable (preview/published), ya que el dominio de origen es diferente al de Supabase Storage.

### Solucion
Modificar el metodo `downloadFromUrl` para usar una estrategia mas robusta:
1. Primero intentar con `fetch()` (funciona cuando CORS lo permite)
2. Si falla, usar un `<a>` tag con `href` directo a la URL (abre en nueva pestana pero siempre funciona)

### Archivo a modificar

**`src/services/ofertaPdfStorageService.ts`** - Metodo `downloadFromUrl` (linea ~282)

Cambiar de:
```typescript
async downloadFromUrl(url: string, filename: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`);
      }
      const blob = await response.blob();
      this.downloadBlob(blob, filename);
    } catch (error) {
      console.error('Error downloading from URL:', error);
      throw error;
    }
}
```

A:
```typescript
async downloadFromUrl(url: string, filename: string): Promise<void> {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`);
      }
      const blob = await response.blob();
      this.downloadBlob(blob, filename);
    } catch (error) {
      console.warn('Fetch download failed, opening in new tab:', error);
      // Fallback: abrir en nueva pestana si CORS bloquea el fetch
      window.open(url, '_blank');
    }
}
```

### Resumen
- 1 archivo modificado: `src/services/ofertaPdfStorageService.ts`
- El cambio agrega un fallback que abre el PDF en nueva pestana si el fetch directo falla, evitando que el usuario vea un error sin poder descargar el PDF
