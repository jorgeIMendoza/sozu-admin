

## Plan: Ejecutar migración real de `proyectos.url_firma_recibos`

Invocar la Edge Function `migrar-archivos-storage` con `dry_run: false` para migrar los 3 archivos de firma de recibos al bucket `legacy-uploads` en Supabase Storage y actualizar las URLs en la base de datos.

### Acción

Llamar a la función con:
```json
{
  "tabla": "proyectos",
  "columna": "url_firma_recibos",
  "carpeta": "proyectos",
  "dry_run": false
}
```

Esto descargará los 3 archivos desde `api.sozu.com`, los subirá a `legacy-uploads/proyectos/` y actualizará las URLs en la tabla `proyectos`.

