

## Plan: Configuracion dinamica de duracion y tipos de citas

### Resumen

Actualmente la duracion de las citas esta fija en 90 minutos y el calendario siempre apunta a `jorge.mendoza@sozu.com`. Se necesita:

1. **Duracion configurable por usuario** (30 min a 2 hrs, en incrementos de 30 min)
2. **Tipos de cita configurables** (capacitacion, visita showroom, etc.)
3. **Asociar el tipo de cita al usuario** para que cada tipo tenga su propia duracion y calendario
4. **Los slots en la UI** deben respetar la duracion configurada

---

### Cambios en base de datos

**1. Nueva tabla `tipos_cita`**
```text
tipos_cita
- id (serial PK)
- nombre (text) -- ej: "Capacitación", "Visita Showroom"  
- activo (boolean, default true)
- fecha_creacion (timestamptz)
```

Se insertaran los dos tipos iniciales: "Capacitación" y "Visita Showroom".

**2. Nueva tabla `configuracion_citas_usuarios`**
Almacena la config por usuario y tipo de cita:
```text
configuracion_citas_usuarios
- id (serial PK)
- id_usuario_email (text, NOT NULL)
- id_tipo_cita (int, FK -> tipos_cita.id)
- duracion_minutos (int, NOT NULL, default 60) -- 30, 60, 90, 120
- calendario_email (text) -- email del calendario Google donde se agenda
- activo (boolean, default true)
- fecha_creacion (timestamptz)
- fecha_actualizacion (timestamptz)
- UNIQUE(id_usuario_email, id_tipo_cita)
```

**3. Agregar columna a `configuracion_citas_horarios`**
```text
ALTER TABLE configuracion_citas_horarios 
  ADD COLUMN id_tipo_cita integer REFERENCES tipos_cita(id) DEFAULT 1;
```
Esto permite que los slots de horario sean por tipo de cita. Los registros existentes quedaran con tipo 1 (Capacitacion).

**4. Actualizar constraint unique** en `configuracion_citas_horarios` para incluir `id_tipo_cita`.

---

### Cambios en la UI (`ConfiguracionCitas.tsx`)

1. **Selector de tipo de cita**: Despues de seleccionar usuario, mostrar tabs o selector para el tipo de cita.
2. **Configuracion de duracion**: Un `Select` con opciones 30 min, 1 hr, 1 hr 30 min, 2 hrs.
3. **Calendario destino**: Un input de texto para el email del calendario Google.
4. **Los dias y horarios** se filtran por tipo de cita seleccionado.
5. **Guardar** persiste tanto la config de usuario-tipo (duracion, calendario) como los slots horarios.

---

### Cambios en Edge Function (`agendar-capacitacion`)

1. Ya no usar `CALENDAR_ID` hardcodeado. En su lugar, recibir el tipo de cita o buscarlo desde `configuracion_citas_usuarios`.
2. Leer `duracion_minutos` y `calendario_email` de la tabla `configuracion_citas_usuarios` para el usuario correspondiente.
3. Calcular `hora_fin` usando la duracion configurada en lugar del valor fijo de 90 min.
4. Usar `calendario_email` para las llamadas a Google Calendar API.

---

### Cambios en `AgendarCitaShowroomDialog.tsx`

1. La duracion de la cita (actualmente fija en 1 hora) debe leerse de `configuracion_citas_usuarios` para el agente y el tipo "Visita Showroom".

---

### Secuencia de implementacion

1. Migracion SQL (tabla `tipos_cita`, tabla `configuracion_citas_usuarios`, alter `configuracion_citas_horarios`)
2. Actualizar `ConfiguracionCitas.tsx` con selector de tipo, duracion y calendario
3. Actualizar Edge Function `agendar-capacitacion` para usar config dinamica
4. Actualizar `AgendarCitaShowroomDialog.tsx` para respetar duracion configurada

---

### Seccion tecnica

- Los slots de 30 minutos en la UI se generaran como: 09:00, 09:30, 10:00, ..., 20:00
- Al validar disponibilidad, se verificara que haya espacio para la duracion completa configurada (ej: si duracion=90min y slot=10:00, se verifica 10:00-11:30)
- RLS policies para las nuevas tablas seguiran el mismo patron que `configuracion_citas_horarios`
- La tabla `tipos_cita` es administrable pero por ahora se seedean los dos tipos iniciales

