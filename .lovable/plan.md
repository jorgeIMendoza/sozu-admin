
# Plan: Corregir Descarga de XML de Google Drive (Error 403)

## Diagnóstico del Problema
El error 403 ocurre porque los archivos en Google Drive **no son públicos**. La URL de descarga directa (`/uc?export=download`) solo funciona con archivos que tienen permisos de "Cualquiera con el enlace".

**URL actual del XML:**
`https://drive.google.com/file/d/136-8u5gsILS30EX2B3ZAfwP3kGEl8a_d/preview`

**URL convertida que da error:**
`https://drive.google.com/uc?export=download&id=136-8u5gsILS30EX2B3ZAfwP3kGEl8a_d` → **403 Forbidden**

---

## Solución Propuesta
Cambiar el comportamiento del badge XML para **abrir el archivo en una nueva pestaña** usando la URL de vista (`/view`), donde el usuario puede descargarlo manualmente desde la interfaz de Google Drive.

**Nuevo comportamiento:**
- Clic en badge XML → Abre nueva pestaña con Google Drive viewer
- El usuario puede descargar desde el botón de descarga de Google Drive (que sí tiene acceso si está logueado)

---

## Cambios Técnicos

### Archivo: `src/utils/googleDriveUrl.ts`
Agregar nueva función que convierte a URL de vista:

```typescript
export function convertToGoogleDriveViewUrl(url: string): string {
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) return url;
  return `https://drive.google.com/file/d/${fileId}/view`;
}
```

Modificar `downloadDocument()` para usar `/view` en lugar de `/uc?export=download`:

```typescript
export function downloadDocument(url: string, filename?: string): void {
  if (isGoogleDriveUrl(url)) {
    // Abrir en Google Drive viewer (permite descarga manual)
    const viewUrl = convertToGoogleDriveViewUrl(url);
    window.open(viewUrl, '_blank');
  } else {
    // Para otras URLs, descarga directa
    const link = document.createElement('a');
    link.href = url;
    if (filename) link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
```

### Archivo: `src/components/admin/FacturasTab.tsx`
No requiere cambios adicionales - ya usa la función `downloadDocument()`.

---

## Alternativa para Futuro
Si se requiere descarga directa sin intervención del usuario:
1. **Hacer los archivos públicos** en Google Drive ("Cualquiera con el enlace")
2. **Integrar Google Drive API** con OAuth para acceso autenticado
3. **Migrar archivos a Supabase Storage** donde no hay restricciones de acceso

---

## Resumen de Archivos

| Archivo | Acción |
|---------|--------|
| `src/utils/googleDriveUrl.ts` | Modificar función `downloadDocument()` para usar `/view` |
