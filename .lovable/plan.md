

# Mejoras al Portal de Agentes — 7 Puntos

## Resumen
Se implementan 7 mejoras al portal de agentes: imágenes clicables en inventario, sección de citas en inicio, botón "Agendar cita" en detalle de desarrollo, galería horizontal de modelos, amenidades colapsables, reordenamiento de secciones, y plano de planta en la vista de propiedad.

---

## 1. Imágenes de desarrollos como botón en Inventario
**Archivo:** `src/pages/admin/agent-portal/AgentInventario.tsx`

- Envolver la imagen del proyecto (el `div` con clase `h-44 lg:h-96`) con un `onClick` que ejecute la misma navegación que "Ver Desarrollo" (`/admin/agent/inventario/proyecto/${proyecto.id}`).
- Agregar `cursor-pointer` a la imagen.
- El botón "Ver Desarrollo" se conserva sin cambios.

---

## 2. Sección de citas agendadas en Inicio
**Archivo:** `src/pages/admin/agent-portal/AgentInicio.tsx`

- Agregar un query a `reservas_citas` filtrado por el email del agente (`email_agente = agentEmail`) y `activo = true`, ordenado por `fecha` ascendente.
- Mostrar una nueva sección "Citas" debajo de las métricas comerciales con dos subsecciones:
  - **Próximas**: citas con `fecha >= hoy` (estatus pendiente/confirmada).
  - **Historial**: citas pasadas o con estatus `asistio`/`no_asistio`, limitado a últimas 5, con un "Ver más" opcional.
- Cada tarjeta de cita muestra: título/tipo de cita, fecha/hora, ubicación, estatus (badge coloreado).
- Nota sobre push notifications: Las notificaciones push requieren implementar un Service Worker y Firebase Cloud Messaging o similar, lo cual es un feature independiente y más extenso. Se dejará preparado el dato pero no se implementarán push notifications en este alcance.

---

## 3. Botón "Agendar cita" en detalle de desarrollo
**Archivo:** `src/pages/admin/agent-portal/AgentProyectoDetalle.tsx`

- Importar `AgendarCitaShowroomDialog`.
- Agregar estado `agendarCitaOpen`.
- En la sección CTA (línea ~660), agregar un botón "Agendar cita" con ícono `CalendarPlus` debajo del botón "Generar oferta comercial" y antes de "Compartir proyecto".
- El botón abre el mismo diálogo `AgendarCitaShowroomDialog` usado en Inicio.

---

## 4. Galería horizontal de modelos con planta e imagen
**Archivo:** `src/pages/admin/agent-portal/AgentProyectoDetalle.tsx`

- Modificar el query de modelos (línea ~261) para incluir `url_imagen_portada` y `plano_arquitectonico` del modelo: `modelos!fk_...(id, nombre, numero_recamaras, numero_completo_banos, numero_medio_bano, url_imagen_portada, plano_arquitectonico)`.
- Reemplazar la sección "Modelos" (actualmente un listado vertical con `space-y-3`) por un scroll horizontal (`flex overflow-x-auto gap-3 pb-2`).
- Cada tarjeta de modelo mostrará:
  - Imagen del modelo (de `url_imagen_portada` o `plano_arquitectonico`) en la parte superior.
  - Nombre, m², recámaras, baños, precio desde.
  - Botón "Ver unidades" si hay disponibles.
- Las tarjetas tendrán ancho fijo (`min-w-[260px] max-w-[280px]`).

---

## 5. Amenidades colapsables (ver todas)
**Archivo:** `src/pages/admin/agent-portal/AgentProyectoDetalle.tsx`

- Mostrar solo los primeros 6 amenidades (2 filas de 3 columnas).
- Si hay más de 6, mostrar un botón "Ver todas (N)" que expande para mostrar el resto.
- Usar estado local `showAllAmenidades`.

---

## 6. Reordenar secciones en detalle de desarrollo
**Archivo:** `src/pages/admin/agent-portal/AgentProyectoDetalle.tsx`

Reordenar las secciones dentro de `<div className="px-4 mt-5 space-y-6">` al siguiente orden:

1. Portada (hero + stats — ya están arriba, no cambian)
2. Resumen Disponibilidad (stats row — ya está)
3. Concepto
4. Fecha de entrega
5. Galería
6. Amenidades
7. Ubicación
8. Puntos de interés
9. Vistas
10. Avance de Obra
11. Video de avance
12. Modelos
13. Material Comercial
14. Botones de acción (CTA + Compartir)

Actualmente: Concepto → Fecha entrega → Amenidades → Avance → Video → Galería → Vistas → Ubicación → Puntos → Modelos → Material → CTA.

Cambios: mover Galería antes de Amenidades, Ubicación antes de Puntos de interés, Vistas después de Puntos de interés, Avance de obra después de Vistas.

---

## 7. Plano de planta en vista de propiedad
**Archivo:** `src/pages/admin/agent-portal/AgentUnidadesProyecto.tsx`

- En el `pageProperties` mapping, agregar campos necesarios para el plano: se necesita `id_edificio` y `id_edificio_modelo` de la propiedad (ya disponibles vía el hook `useInventarioDisponiblePaginado`, pero hay que verificar que se pasen).
- En el dialog de detalle de propiedad (línea ~556), antes de la sección de precio (línea ~613), agregar una sección que:
  1. Consulte `modelos_planos_arquitectonicos` buscando por `id_edificio_modelo` y `nivel` (piso).
  2. Si encuentra un plano arquitectónico, muestre la imagen.
  3. Si no, consulte `edificios_niveles_planos` por `id_edificio` y `nivel` para plano de ubicación con highlight.
- Reutilizar la lógica de `PlanosPropertyModal` (consultas a `edificios_niveles_planos` y `modelos_planos_arquitectonicos`) pero renderizado inline en lugar de modal.
- Se necesita que el hook `useInventarioDisponiblePaginado` devuelva `id_edificio` y `id_edificio_modelo` — si no los incluye la RPC, se obtendrán con un query adicional al seleccionar la propiedad.

---

## Detalle técnico

### Archivos a modificar
| Archivo | Cambios |
|---------|---------|
| `AgentInventario.tsx` | onClick en imagen del proyecto |
| `AgentInicio.tsx` | Nueva sección de citas con query a `reservas_citas` |
| `AgentProyectoDetalle.tsx` | Botón agendar cita, galería horizontal de modelos, amenidades colapsables, reorden de secciones |
| `AgentUnidadesProyecto.tsx` | Plano de planta inline en dialog de propiedad |

### Datos adicionales necesarios
- Query a `reservas_citas` por `email_agente` para la sección de citas en Inicio.
- Campos `url_imagen_portada`, `plano_arquitectonico` del modelo para la galería.
- Queries a `edificios_niveles_planos` y `modelos_planos_arquitectonicos` para el plano en la vista de propiedad (se necesitará obtener `id_edificio` e `id_edificio_modelo` de la propiedad seleccionada).

