

## Situacion actual

- Ya existe una pagina de configuracion de notificaciones en `/admin/notificaciones-config` con la tabla `notificaciones_configuracion`
- Esa pagina **NO tiene submenú** en la BD (no aparece en la tabla `submenus`), por lo que no es accesible desde el sidebar
- No existe tabla ni pagina de logs de notificaciones enviadas
- El Edge Function `notificar-agentes` no registra logs de envio en ninguna tabla

## Plan

### 1. Crear tabla `notificaciones_log` (migración)

```sql
CREATE TABLE public.notificaciones_log (
  id bigint generated always as identity primary key,
  tipo_evento text not null,
  canal text not null, -- 'email', 'whatsapp', 'ambos'
  destinatarios_count int not null default 0,
  id_proyecto int references proyectos(id),
  nombre_desarrollo text,
  payload jsonb,
  resultado text not null default 'success', -- 'success', 'error'
  error_detalle text,
  created_at timestamptz not null default now()
);

ALTER TABLE public.notificaciones_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admin can read notification logs"
ON public.notificaciones_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Permitir insert desde service_role (edge functions)
CREATE POLICY "Service role can insert logs"
ON public.notificaciones_log FOR INSERT
TO service_role
WITH CHECK (true);
```

### 2. Registrar submenús en la BD (insert)

Crear dos submenús bajo el menú "Configuraciones/Logs" (ID 13):

- **ID 88** - "Config. Notificaciones" → `/admin/notificaciones-config` (orden 10)
- **ID 89** - "Logs de Notificaciones" → `/admin/notificaciones-log` (orden 11)

Asignar permisos `leer`, `crear`, `actualizar`, `eliminar` al rol Super Admin (ID 1) para ambos submenús.

### 3. Crear pagina `NotificacionesLog.tsx`

Nueva pagina en `src/pages/admin/NotificacionesLog.tsx` que muestre:
- Filtros por rango de fecha, tipo de evento y resultado (success/error)
- Tabla con columnas: Fecha, Evento, Canal, Destinatarios, Proyecto, Resultado, Error
- Paginacion y ordenamiento por fecha descendente
- Badges de color para resultado (verde=success, rojo=error)

### 4. Registrar ruta en App.tsx

Agregar lazy import y ruta `notificaciones-log` bajo `/admin`.

### 5. Agregar rutas a validRoutes.ts y useDynamicMenus.ts

- Agregar `/admin/notificaciones-log` a `VALID_ADMIN_ROUTES`
- Agregar icono para `/admin/notificaciones-log` en `useDynamicMenus.ts`

### 6. Actualizar Edge Function `notificar-agentes`

Despues de enviar la notificacion (exitosa o con error), insertar un registro en `notificaciones_log` con el tipo de evento, canal, cantidad de destinatarios, proyecto y resultado.

