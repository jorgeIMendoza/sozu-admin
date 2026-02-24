

## Mostrar el nombre del capacitador junto al nombre de la configuracion

### Problema
Actualmente, en la seccion de horarios disponibles del paso de Capacitacion, solo se muestra el nombre de la configuracion (ej. "CAPACITACION DAIKU PRESENCIAL") sin indicar quien es el responsable/capacitador.

### Solucion
Modificar la consulta de `trainingConfigs` para traer el nombre del capacitador desde la tabla `personas` (cruzando por email), y mostrarlo junto al nombre de la configuracion.

### Cambios

**Archivo: `src/components/admin/AgentOnboardingStepDialog.tsx`**

1. **Actualizar la query de `trainingConfigs`** (linea ~440-457): Agregar una sub-consulta para obtener el `nombre_legal` de la persona cuyo email coincide con `id_usuario_email` de la configuracion.

2. **Actualizar la visualizacion del grupo de horarios** (linea ~981-983): Cambiar la etiqueta del grupo de:
   ```
   CAPACITACION DAIKU PRESENCIAL
   ```
   a:
   ```
   CAPACITACION DAIKU PRESENCIAL (capacitador: Abel Salazar)
   ```

3. **Actualizar el subtitulo `configName`** (linea ~674): Incluir tambien el nombre del capacitador en el subtitulo que aparece debajo del titulo del dialogo.

### Detalle tecnico

- La tabla `configuracion_citas_usuarios` tiene `id_usuario_email` (texto).
- La tabla `personas` tiene `email` y `nombre_legal`.
- Se hara un segundo query a `personas` filtrando por los emails de las configs obtenidas, para mapear email a nombre.
- Se agregara una propiedad `owner_display_name` a cada config en memoria.
- En la UI, donde se muestra `cfg.nombre` como header de grupo, se concatenara: `cfg.nombre (capacitador: cfg.owner_display_name)`.

