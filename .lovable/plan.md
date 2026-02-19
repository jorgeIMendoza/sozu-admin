

## Plan: Unificar botones de Header y Flotantes en Inventario, Proyectos y Detalle de Proyecto

### Resumen

Estandarizar los botones que aparecen en el header sticky y en los botones flotantes (que aparecen al hacer scroll) para las 4 paginas de agentes: Inventario A, Inventario B, Proyectos y Detalle de Proyecto. Ademas, igualar el tamano de los iconos entre header y flotantes.

---

### Cambios por pagina

#### 1. Inventario A y B (`InventarioGlobal.tsx`, `InventarioGlobalB.tsx`)

**Header (actualmente):** Buscador ("Buscar") + Ordenar + Desarrollos + Prospecto + Cita + Perfil
**Header (nuevo):** Buscador ("Buscador") + Ordenar + Perfil
- Quitar: boton Desarrollos, boton Prospecto, boton Cita
- Renombrar: "Buscar" a "Buscador"

**Flotantes (actualmente):** Desarrollos + Prospecto + Cita + separador + Filtros + Ordenar
**Flotantes (nuevo):** Desarrollos + Prospecto + Cita + separador + Buscador + Ordenar
- Renombrar: "Filtros" a "Buscador" (misma funcionalidad: abre el drawer de filtros)
- Cambiar icono: de `SlidersHorizontal` a `Search`

**Tamano de iconos:** Igualar header y flotantes a `h-4 w-4` (actualmente header usa `h-3.5 w-3.5` y flotantes usan `h-5 w-5`; se estandariza a `h-4 w-4`)

#### 2. Proyectos (`MisProyectos.tsx`)

**Header (actualmente):** Buscador ("Propiedades") + Prospecto + Cita + Perfil
**Header (nuevo):** Buscador ("Buscador") + Perfil
- Quitar: boton Prospecto, boton Cita
- Renombrar: "Propiedades" a "Buscador"

**Flotantes (actualmente):** Prospecto + Cita + separador + Filtros
**Flotantes (nuevo):** Prospecto + Cita + separador + Buscador
- Renombrar: "Filtros" a "Buscador"
- Cambiar icono: de `SlidersHorizontal` a `Search`

**Tamano de iconos:** Igualar a `h-4 w-4`

#### 3. Detalle de Proyecto (`MiProyectoDetalle.tsx`)

**Header (actualmente):** Buscador ("Propiedades") + Desarrollos + Prospecto + Cita + Perfil
**Header (nuevo):** Buscador ("Buscador") + Perfil
- Quitar: boton Desarrollos, boton Prospecto, boton Cita
- Renombrar: "Propiedades" a "Buscador"

**Flotantes (actualmente):** Desarrollos + Prospecto + Cita + separador + Filtros
**Flotantes (nuevo):** Desarrollos + Prospecto + Cita + separador + Buscador
- Renombrar: "Filtros" a "Buscador"
- Cambiar icono: de `SlidersHorizontal` a `Search`

**Tamano de iconos:** Igualar a `h-4 w-4`

---

### Detalle tecnico

**Archivos a modificar (4):**

1. **`src/pages/admin/inmobiliarias/InventarioGlobal.tsx`**
   - Header (lineas ~474-527): Quitar botones de Desarrollos, Prospecto y Cita. Cambiar texto "Buscar" a "Buscador". Ajustar iconos a `h-4 w-4`.
   - Flotantes (lineas ~761-811): Cambiar "Filtros" a "Buscador", icono `SlidersHorizontal` a `Search`. Ajustar iconos a `h-4 w-4`.

2. **`src/pages/admin/inmobiliarias/InventarioGlobalB.tsx`**
   - Header (lineas ~290-307): Mismos cambios que Variante A.
   - Flotantes (lineas ~429-443): Mismos cambios que Variante A.

3. **`src/pages/admin/inmobiliarias/MisProyectos.tsx`**
   - Header (lineas ~458-484): Quitar Prospecto y Cita. Cambiar "Propiedades" a "Buscador". Iconos a `h-4 w-4`.
   - Flotantes (lineas ~721-745): Cambiar "Filtros" a "Buscador", icono a `Search`. Iconos a `h-4 w-4`.

4. **`src/pages/admin/inmobiliarias/MiProyectoDetalle.tsx`**
   - Header (lineas ~293-315): Quitar Desarrollos, Prospecto y Cita. Cambiar "Propiedades" a "Buscador". Iconos a `h-4 w-4`.
   - Flotantes (lineas ~510-529): Cambiar "Filtros" a "Buscador", icono a `Search`. Iconos a `h-4 w-4`.

