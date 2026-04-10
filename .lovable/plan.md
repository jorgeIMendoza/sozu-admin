

## Plan: Edge Function para migrar archivos de api.sozu.com a Supabase Storage

### Resumen

Crear una Edge Function genérica llamada `migrar-archivos-storage` que reciba como parámetros la tabla, columna y bucket destino. La función:
1. Consulta los registros con URLs de `api.sozu.com/storage/uploads/`
2. Descarga cada archivo
3. Lo sube al bucket de Supabase Storage
4. Actualiza la URL en la BD

Tú controlarás qué tabla/columna migrar en cada ejecución.

### Paso 1 — Crear bucket de Storage

Crear una migración SQL para un bucket público llamado `legacy-uploads` donde se almacenarán todos los archivos migrados, organizados en carpetas por tabla (ej: `proyectos/`, `pagos/`, `documentos/`).

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('legacy-uploads', 'legacy-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Política de lectura pública
CREATE POLICY "Public read legacy-uploads"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'legacy-uploads');

-- Política de inserción para service_role (la edge function usa service role)
CREATE POLICY "Service insert legacy-uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'legacy-uploads');
```

### Paso 2 — Crear Edge Function `migrar-archivos-storage`

La función aceptará un POST con:
```json
{
  "tabla": "proyectos",
  "columna": "url_firma_recibos",
  "carpeta": "proyectos",
  "limit": 50,
  "dry_run": true
}
```

- **dry_run: true** → solo lista los registros que se migrarían, sin tocar nada
- **dry_run: false** → ejecuta la migración real
- **limit** → controla cuántos registros procesar por lote

La función usará `SUPABASE_SERVICE_ROLE_KEY` para tener permisos completos de Storage y BD.

Flujo interno:
1. SELECT registros donde la columna contiene `api.sozu.com/storage/uploads/`
2. Para cada registro:
   - Extraer el nombre del archivo de la URL
   - Descargar el archivo con `fetch()`
   - Subir a Supabase Storage en `legacy-uploads/{carpeta}/{nombre_archivo}`
   - UPDATE la fila con la nueva URL pública de Supabase
3. Retornar resumen: total encontrados, migrados exitosamente, errores

### Paso 3 — Registrar en config.toml

Agregar la función con `verify_jwt = false` para que puedas invocarla fácilmente.

### Uso

Una vez desplegada, tú la invocarás tabla por tabla. Ejemplo para empezar con `proyectos.url_firma_recibos`:

```bash
# Primero dry_run para ver qué se migraría
POST /migrar-archivos-storage
{ "tabla": "proyectos", "columna": "url_firma_recibos", "carpeta": "proyectos", "dry_run": true }

# Luego ejecutar
POST /migrar-archivos-storage  
{ "tabla": "proyectos", "columna": "url_firma_recibos", "carpeta": "proyectos", "dry_run": false, "limit": 50 }
```

### Tablas a migrar (en el orden que tú elijas)

| # | Tabla | Columna | Registros |
|---|-------|---------|-----------|
| 1 | proyectos | url_firma_recibos | 3 |
| 2 | proyectos | url_logo | 15 |
| 3 | proyectos | url_imagen_portada | 16 |
| 4 | personas | url_imagen | 46 |
| 5 | amenidades | url_icono | 94 |
| 6 | vistas | url_imagen | 115 |
| 7 | multimedias_proyecto | url | 3,739 |
| 8 | documentos | url | 4,049 |
| 9 | pagos | url_recibo | 6,150 |
| 10 | pagos | url_cep | 14,112 |
| 11 | multimedias_modelo | url | 14,797 |
| 12 | propiedades | url_imagen_portada | 29,626 |
| 13 | multimedias_propiedad | url | 250,668 |

### Archivos a crear/modificar

- `supabase/migrations/xxx.sql` — bucket y políticas
- `supabase/functions/migrar-archivos-storage/index.ts` — la Edge Function
- `supabase/config.toml` — registrar la función

