## Continuar migración de archivos legacy

### Estado actual
- `vistas.url`: completado
- `amenidades.url`: completado
- `proyectos.url_logo`: ~33 pendientes (errores 522 intermitentes)
- `personas.url_logo`: 759 pendientes

### Acciones a ejecutar
1. **Reintentar `proyectos.url_logo`**: invocar `migrar-archivos-storage` en lotes de 20 hasta llegar a 0 pendientes. Reintentar los 522 hasta 3 veces por lote.
2. **Procesar `personas.url_logo`**: invocar la edge function en lotes de 20 (carpeta `personas`) hasta agotar los 759 registros. Esto puede tomar varias rondas; reintentar fallos por 522.
3. **Resumen final**: tras cada tabla, consultar el conteo de URLs `api.sozu.com` restantes vía `supabase--read_query` y reportar:
   - Total migrados exitosamente
   - Total con error persistente (con IDs y motivo)
   - Pendientes restantes por tabla

### Detalles técnicos
- Endpoint: `POST /functions/v1/migrar-archivos-storage`
- Body: `{ tabla, columna, carpeta, limit: 20, dry_run: false }`
- Bucket destino: `legacy-uploads`
- Concurrencia interna: 8 (ya configurada)
- No se modifica código; solo se ejecutan llamadas HTTP y queries de verificación.