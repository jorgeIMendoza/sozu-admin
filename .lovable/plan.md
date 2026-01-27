
# Plan: Edge Function `generar-oferta-pdf`

## Objetivo
Crear un Edge Function que genere PDFs de ofertas (propiedades y productos) de forma centralizada, permitiendo que sistemas externos puedan solicitar la generación via HTTP.

## Arquitectura Propuesta

```text
┌─────────────────────┐     POST /generar-oferta-pdf     ┌──────────────────────┐
│  Sistema Externo    │ ──────────────────────────────▶  │   Edge Function      │
│  (n8n, API, etc.)   │                                  │  generar-oferta-pdf  │
└─────────────────────┘                                  └──────────────────────┘
                                                                    │
                                                                    ▼
                                                         ┌──────────────────────┐
                                                         │  1. Fetch oferta     │
                                                         │  2. Detect tipo      │
                                                         │  3. Fetch all data   │
                                                         │  4. Generate PDF     │
                                                         │  5. Upload Storage   │
                                                         │  6. Return URL       │
                                                         └──────────────────────┘
```

## Cambios a Implementar

### 1. Crear Edge Function `supabase/functions/generar-oferta-pdf/index.ts`

**Entrada (POST body)**:
```json
{
  "offerId": 12345
}
```

**Salida (exitosa)**:
```json
{
  "success": true,
  "url_oferta": "https://...supabase.co/storage/v1/object/public/documentos/ofertas_temp/...",
  "fileName": "O_000123_PropXYZ_Proyecto.pdf",
  "expiresIn": "1 minute",
  "tipoOferta": "propiedad" // o "producto"
}
```

**Lógica principal**:
1. Recibir `offerId`
2. Consultar tabla `ofertas` para obtener datos base
3. Determinar si es oferta de propiedad (`id_producto IS NULL`) o producto (`id_producto IS NOT NULL`)
4. Según el tipo, obtener todos los datos necesarios:
   - **Propiedad**: propiedad, edificio, modelo, proyecto, esquemas de pago, estacionamientos, bodegas, datos del lead, datos del creador
   - **Producto**: producto, categoría, propiedad relacionada, esquemas de pago, datos bancarios del dueño
5. Generar PDF usando `pdf-lib` (compatible con Deno/Edge Functions)
6. Subir a Storage bucket `documentos` en carpeta `ofertas_temp/`
7. Programar eliminación automática después de 1 minuto
8. Retornar URL pública

### 2. Actualizar `supabase/config.toml`
Agregar configuración para la nueva función con `verify_jwt = false` (para permitir llamadas externas).

### 3. (Opcional) Crear servicio frontend `ofertaPdfEdgeFunctionService.ts`
Un servicio que llame al Edge Function para unificar la generación desde el frontend también.

## Detalles Técnicos

### Librerías a usar en Edge Function
- `pdf-lib` (ya usado en `generar-recibo-pago`) para generación de PDF
- `@supabase/supabase-js` para consultas y storage

### Datos a obtener por tipo

**Oferta de Propiedad**:
| Tabla | Campos clave |
|-------|--------------|
| ofertas | id, fecha_generacion, email_creador, id_esquema_pago_seleccionado, id_persona_lead, id_propiedad |
| propiedades | numero_propiedad, precio_lista, m2_interiores, m2_exteriores, numero_piso, clabe_stp_tmp_apartado |
| edificios_modelos → edificios → proyectos | nombre, url_logo |
| modelos | nombre, numero_recamaras, numero_completo_banos |
| esquemas_pago | todos los campos de esquema |
| personas (lead) | nombre_legal, email, telefono, rfc |
| personas/usuarios (creador) | nombre_legal, email, telefono |
| estacionamientos | asociados a la propiedad |
| bodegas | asociadas a la propiedad |

**Oferta de Producto**:
| Tabla | Campos clave |
|-------|--------------|
| ofertas | id, fecha_generacion, email_creador, id_esquema_pago_seleccionado, id_persona_lead, id_producto, clabe_stp_tmp_producto |
| productos_servicios | nombre, precio_lista, id_categoria |
| categorias_producto | nombre |
| propiedades (relacionada) | numero_propiedad |
| esquemas_pago | del producto |
| entidades_relacionadas → personas | datos del dueño |
| cuentas_bancarias | cuenta STP del dueño |

### Estructura del PDF
Se replicará la estructura visual actual de los servicios frontend:
- Header con logo del proyecto
- Datos de la propiedad/producto
- Esquemas de pago (cards)
- Datos bancarios (STP y efectivo)
- Datos de contacto (agente y comprador)

### Storage y URLs efímeras
- Bucket: `documentos`
- Carpeta: `ofertas_temp/`
- Nombre archivo: `O_{offerId}_{propiedad/producto}_{timestamp}.pdf`
- Auto-eliminación: 60 segundos (setTimeout como en `generar-recibo-pago`)

## Estimación
- **Complejidad**: Alta (port de ~900 líneas de lógica de frontend)
- **Archivos nuevos**: 1 Edge Function (~700-900 líneas)
- **Archivos modificados**: 1 (config.toml)
- **Archivos opcionales**: 1 (servicio frontend)

## Consideraciones
- El Edge Function será más largo que `generar-recibo-pago` debido a los dos tipos de ofertas
- Las imágenes (logo, firma) se obtienen via fetch y se embeben en el PDF
- La validación de RFC se replica para mostrar/ocultar sección bancaria
- Se mantiene compatibilidad con el formato actual de los PDFs generados en frontend
