

# Plan: Sistema Configurable de Notificaciones con UI en Configuraciones/Logs

## Resumen

Crear un sistema de notificaciones configurable con: (1) tabla de configuración, (2) Edge Function dispatcher que reutiliza `enviar-notificacion`, (3) página admin bajo el menú Configuraciones/Logs como submenú "Notificaciones", (4) triggers en carga masiva y esquemas de pago.

---

## 1. Migración de base de datos

### Tabla `notificaciones_configuracion`

```sql
CREATE TABLE notificaciones_configuracion (
  id serial PRIMARY KEY,
  tipo_evento text UNIQUE NOT NULL,
  descripcion text,
  canal text NOT NULL DEFAULT 'ambos',  -- 'email' | 'whatsapp' | 'ambos'
  roles_destino integer[] NOT NULL DEFAULT '{1,3,9}',
  activo boolean NOT NULL DEFAULT true,
  requiere_acceso_proyecto boolean NOT NULL DEFAULT true,
  asunto_email text NOT NULL,
  plantilla_wa text NOT NULL,
  plantilla_email_detalles text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

Seed con 2 registros iniciales:
- `precio_actualizado` — roles `{1,3,9}`, canal `ambos`, plantilla WA: `"📢 Se actualizaron los precios del desarrollo *{nombre_desarrollo}*. Revisa la lista actualizada."`, asunto: `"Actualización de Precios - {nombre_desarrollo}"`
- `nuevo_esquema_pago` — roles `{1,3,9}`, canal `ambos`, plantilla WA: `"📢 Nuevo esquema de pago *{nombre_esquema}* en el desarrollo *{nombre_desarrollo}*."`, asunto: `"Nuevo Esquema de Pago - {nombre_desarrollo}"`

### Insertar submenú "Notificaciones" en menú 13

Insertar en `submenus`:
- `nombre`: "Notificaciones", `menu_id`: 13, `vista_front_end`: `/admin/notificaciones-config`, `activo`: true, `orden`: 10

### Asignar permisos al submenú

Insertar en `submenus_permisos` los permisos de leer, crear, actualizar para el rol Super Administrador (rol_id 1) y otros roles que correspondan.

---

## 2. Edge Function `notificar-agentes`

Función dispatcher que:

1. Recibe `{ tipo_evento, id_proyecto, datos: { nombre_desarrollo?, nombre_esquema?, ... } }`
2. Consulta `notificaciones_configuracion` por `tipo_evento` → si `!activo`, retorna
3. Consulta nombre del proyecto si no viene en datos
4. Obtiene destinatarios:
   - Roles en `roles_destino` con `activo = true` en `usuarios`
   - Rol 1 (Super Admin): recibe siempre sin filtro de proyecto
   - Roles 3, 9 (y cualquier otro): filtra por `proyectos_acceso` WHERE `proyecto_id = id_proyecto` AND `activo = true`
5. Obtiene códigos de país de tabla `paises` (mismo patrón de `registro-inmobiliaria-publica`)
6. Para cada destinatario:
   - Reemplaza placeholders `{nombre_desarrollo}`, `{nombre_esquema}` en plantillas
   - **Validación WA**: verifica que `telefono` exista y tenga ≥10 dígitos; si no, degrada a solo email
   - Determina `tipo`: según `canal` de config y validez del teléfono
   - Llama a `enviar-notificacion` con payload estándar (templateId 41353048, from Sozu)

---

## 3. Página admin `/admin/notificaciones-config`

UI dentro de Configuraciones/Logs que muestra una tabla con todas las notificaciones configuradas:

| Columna | Controles |
|---------|-----------|
| Evento | Texto (solo lectura) |
| Descripción | Texto (solo lectura) |
| Canal | Select: Email / WhatsApp / Ambos |
| Roles Destino | Checkboxes multiselect con nombres de roles |
| Activo | Toggle switch |
| Mensaje WA | Textarea editable con placeholders |
| Asunto Email | Input editable |
| Plantilla Email | Textarea editable |

Cada fila es editable inline o mediante un dialog de edición. Se guarda con UPDATE a la tabla.

---

## 4. Triggers en frontend

### `BulkUploadPropertiesDialog.tsx`
Después de `result.success === true`:
```typescript
if (result.id_proyecto) {
  supabase.functions.invoke('notificar-agentes', {
    body: {
      tipo_evento: 'precio_actualizado',
      id_proyecto: result.id_proyecto,
      datos: { nombre_desarrollo: result.nombre_desarrollo }
    }
  });
}
```
Nota: depende de que N8N devuelva `id_proyecto` y `nombre_desarrollo` en la respuesta. Si no los devuelve aún, se documenta para configurar en N8N.

### `NewPaymentSchemeDialog.tsx`
Después del insert exitoso, invocar con el `projectId` que ya recibe como prop.

### `NewProductPaymentSchemeDialog.tsx`
Después del insert exitoso, resolver `id_proyecto` desde `productId` consultando tabla `productos`, luego invocar.

---

## 5. Registro en rutas y menús del código

| Archivo | Cambio |
|---------|--------|
| `src/utils/validRoutes.ts` | Agregar `/admin/notificaciones-config` |
| `src/hooks/useDynamicMenus.ts` | Agregar icono `Bell` para `/admin/notificaciones-config` |
| `src/App.tsx` | Agregar ruta lazy para la nueva página |

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| Migración SQL | Crear tabla + seed + submenú + permisos |
| `supabase/functions/notificar-agentes/index.ts` | Crear dispatcher |
| `src/pages/admin/NotificacionesConfig.tsx` | Crear página de configuración |
| `src/utils/validRoutes.ts` | Agregar ruta |
| `src/hooks/useDynamicMenus.ts` | Agregar icono |
| `src/App.tsx` | Agregar ruta |
| `src/components/admin/BulkUploadPropertiesDialog.tsx` | Agregar invocación |
| `src/components/admin/NewPaymentSchemeDialog.tsx` | Agregar invocación |
| `src/components/admin/NewProductPaymentSchemeDialog.tsx` | Agregar invocación |

