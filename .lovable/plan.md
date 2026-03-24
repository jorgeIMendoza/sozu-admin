

# Plan: Corregir imagen de portada en portal cliente + Imagen portada en modelos + Hero en portal agente

## Problema 1: Hero de proyecto en portal agente se estira en desktop
**Archivo**: `src/pages/admin/agent-portal/AgentProyectoDetalle.tsx` (línea 339)
- Actualmente: `h-56 w-full` — la imagen se estira horizontalmente en pantallas anchas
- Solución: Cambiar a `h-56 lg:h-80` con `max-w-screen-xl mx-auto` para limitar el ancho en desktop, y mantener `object-cover object-center` para que se vea centrada y recortada correctamente

## Problema 2: Imagen de portada en portal cliente usa imagen random del modelo
**Archivo**: `src/hooks/useClienteResumenFinanciero.ts` (líneas 260-274)
- Actualmente la prioridad es: `multimedias_modelo` (ver_como_imagen_de_propiedad) → `proyecto.url_imagen_portada`
- La propiedad tiene su propio campo `url_imagen_portada` en la tabla `propiedades` pero nunca se consulta
- **Cambio**: Modificar la query de propiedades para incluir `url_imagen_portada`, y cambiar la prioridad a:
  1. `propiedad.url_imagen_portada` (si existe)
  2. `modelo.url_imagen_portada` (nuevo campo, si existe)  
  3. `multimedias_modelo` con `ver_como_imagen_de_propiedad=true` (fallback actual)
  4. `proyecto.url_imagen_portada` (último fallback)

## Problema 3: Agregar `url_imagen_portada` a la tabla `modelos`
- **Migración SQL**: `ALTER TABLE modelos ADD COLUMN url_imagen_portada text;`
- **Archivo**: `src/components/admin/EditModeloDialog.tsx`
  - Agregar campo de URL de imagen de portada al formulario (input de texto + preview de imagen)
  - Incluir `url_imagen_portada` en el objeto de update al guardar

## Cambios por archivo

### 1. Migración SQL
```sql
ALTER TABLE modelos ADD COLUMN url_imagen_portada text;
```

### 2. `src/components/admin/EditModeloDialog.tsx`
- Agregar campo `url_imagen_portada` al schema y formulario
- Agregar input con preview de imagen, similar al de proyectos

### 3. `src/hooks/useClienteResumenFinanciero.ts`
- En la query de propiedades (~línea 91), incluir `url_imagen_portada`
- En la query de edificios_modelos (~línea 178), agregar join a modelos para obtener `url_imagen_portada` del modelo
- Cambiar prioridad de imagen (línea 274): `prop.url_imagen_portada || modelo.url_imagen_portada || modelImg || projInfo.imageUrl`

### 4. `src/pages/admin/agent-portal/AgentProyectoDetalle.tsx`
- Cambiar el hero de `h-56` a `h-56 lg:h-80` y agregar `object-center` para mejor visualización en desktop

