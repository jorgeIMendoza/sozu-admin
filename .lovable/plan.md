

## Corregir disponibilidad de horarios en la edge function agendar-capacitacion

### Problema

La edge function `agendar-capacitacion` tiene 3 bugs en la generacion de slots disponibles:

1. **Domingos devuelven slots incorrectos**: La condicion `if (dayOfWeek > 0)` hace que el dia 0 (domingo) salte la validacion de horarios configurados, devolviendo todos los slots por defecto (09:00-16:30) aunque el domingo no este configurado.

2. **Rango de horarios limitado a 09:00-16:30**: El loop de generacion de slots esta hardcodeado con `for (let h = 9; h <= 16; h++)`, por lo que horarios configurados despues de las 16:30 (como 17:00, 18:00, 19:00, 20:00) nunca se generan.

3. **Query de Google Calendar limitado a 09:00-18:00**: Los parametros `timeMin` y `timeMax` de la API de Google Calendar estan fijos, no cubren horarios mas tarde.

### Datos actuales en la BD

La configuracion 15 (Showroom Mutuo Hidalgo) solo tiene guardados:
- Lunes (dia 1) hora 10
- Miercoles (dia 3) hora 10

Esto significa que actualmente la API devuelve **correctamente** solo horarios 10:00/10:30 para esos dias. Si se desean mas horarios disponibles, se deben agregar en la pantalla de Configuracion de Citas.

### Cambios

**Archivo: `supabase/functions/agendar-capacitacion/index.ts`**

#### 1. Corregir manejo de domingo (dia 0)

Cambiar la condicion `if (dayOfWeek > 0)` por una validacion que tambien cubra domingos. Si el dia 0 no tiene horarios configurados y existen configuraciones para otros dias, devolver array vacio.

```text
Antes:  if (dayOfWeek > 0) { ... }
Ahora:  // Siempre verificar horarios configurados, incluyendo domingo
```

#### 2. Extender rango de generacion de slots

Cambiar el loop de `for (let h = 9; h <= 16; h++)` a un rango dinamico basado en los horarios configurados. Si hay slots configurados, usar el minimo y maximo de esas horas. Si no hay configuracion, usar el rango por defecto 9-20.

```text
Antes:  for (let h = 9; h <= 16; h++)
Ahora:  Calcular minHour/maxHour desde configuredSlots, o usar 9-20 como default
```

#### 3. Extender timeMin/timeMax de Google Calendar

Ajustar el rango de consulta a Google Calendar para cubrir desde las 06:00 hasta las 23:00, asegurando que se detecten eventos que puedan bloquear horarios en cualquier hora configurada.

```text
Antes:  timeMin = 09:00, timeMax = 18:00
Ahora:  timeMin = 06:00, timeMax = 23:00
```

### Resultado esperado

Con estos cambios:
- Domingo sin configuracion -> devuelve `[]` (vacio)
- Lunes con hora 10 configurada -> devuelve `["10:00"]` (o `["10:00","10:30"]` si la duracion lo permite)
- Miercoles con hora 10 configurada -> devuelve `["10:00"]` (o `["10:00","10:30"]`)
- Si se agregan mas horas (ej. 09, 11, 14, 18) en la configuracion -> apareceran correctamente

**Nota importante**: Si deseas que aparezcan todos los horarios de 09:00 a 20:00 para Lunes y Miercoles, necesitas agregarlos en la pantalla de Configuracion de Citas (actualmente solo esta guardada la hora 10).

