
# Optimizacion de Rendimiento - Inventario Disponible

## Problema Identificado

La funcion RPC `get_inventario_disponible` devuelve **41,486 propiedades** de golpe al cliente. Aunque solo se muestran 30 por pagina, el frontend:

1. Crea un objeto JavaScript por cada una de las 41k+ propiedades (en `useMemo`)
2. Ejecuta `shuffleArray` sobre las 41k+ propiedades (operacion O(n))
3. Calcula filtros disponibles iterando las 41k+ propiedades multiples veces
4. Instancia un carrusel Embla por cada tarjeta visible (30 instancias simultaneas)
5. Cada cambio de filtro o paginacion re-procesa todo el arreglo

En mobile con procesadores limitados, esto causa la lentitud y falta de fluidez.

## Solucion Propuesta: Paginacion en Servidor

### Paso 1: Crear nueva funcion RPC con paginacion

Crear `get_inventario_disponible_v2` que acepte parametros:

```text
- p_accessible_project_ids (int[]) -- filtro de acceso
- p_project_names (text[])         -- filtro por proyecto
- p_model_names (text[])           -- filtro por modelo  
- p_bedrooms (int[])               -- filtro por recamaras
- p_levels (text[])                -- filtro por nivel/piso
- p_has_bodega (boolean)           -- filtro bodega
- p_has_estacionamiento (boolean)  -- filtro estacionamiento
- p_sort_price (text)              -- 'asc', 'desc', o null
- p_page_size (int)                -- default 30
- p_page (int)                     -- pagina actual (0-indexed)
```

La funcion devolvera:

```text
{
  propiedades: [...],         -- solo las 30 de la pagina actual
  total_count: 41486,         -- total para calcular paginacion
  modelo_imagenes: {...},     -- solo las de los modelos en esta pagina
  esquemas_pago_proyecto: {}, -- solo las de los proyectos en esta pagina
  filter_options: {           -- opciones disponibles para los filtros
    proyectos: ["Nombre1", "Nombre2", ...],
    modelos: ["ModeloA", "ModeloB", ...],
    recamaras: [1, 2, 3],
    niveles: ["1", "2", "3", ...]
  }
}
```

### Paso 2: Nuevo hook `useInventarioDisponiblePaginado`

Reemplazar el hook actual con uno que:
- Envie filtros y paginacion al servidor
- Use `keepPreviousData: true` en React Query para transiciones suaves
- Solo almacene las 30 propiedades de la pagina actual en memoria

### Paso 3: Optimizar los carruseles de tarjetas

- Para propiedades con 1 sola imagen: renderizar un `<img>` simple sin Embla
- Solo instanciar Embla cuando hay 2+ imagenes Y el usuario interactua (swipe)
- Esto reduce de 30 instancias de carrusel a casi 0 en la carga inicial

### Paso 4: Virtualizar con `React.memo`

- Envolver `PropertyCardCarousel` y las tarjetas de propiedad con `React.memo` para evitar re-renders innecesarios al cambiar de pagina

## Resultado Esperado

| Metrica | Antes | Despues |
|---------|-------|---------|
| Datos en memoria | 41k+ objetos | 30 objetos |
| Tiempo de procesamiento JS | Alto (shuffle + filtros sobre 41k) | Minimo (30 items listos) |
| Instancias de carrusel | 30 Embla | 0-5 Embla (lazy) |
| Payload de red | Grande (todo el inventario) | Pequeno (1 pagina) |

## Secuencia de Implementacion

1. Migracion SQL: crear funcion RPC `get_inventario_disponible_v2`
2. Nuevo hook: `useInventarioDisponiblePaginado.ts`
3. Actualizar `InventarioGlobal.tsx`: usar nuevo hook, eliminar procesamiento client-side
4. Optimizar `PropertyCardCarousel`: imagen simple para 1 foto, Embla lazy para 2+

## Seccion Tecnica

- La funcion RPC usara `LIMIT/OFFSET` internamente con los filtros aplicados en SQL
- Las opciones de filtro (`filter_options`) se calcularan con `SELECT DISTINCT` en la misma consulta
- Se mantendra compatibilidad con el hook anterior (`useInventarioDisponible`) para no romper la variante B del A/B test
- El `shuffleArray` se reemplazara por `ORDER BY random()` en SQL (con `SEED` fijo por sesion si se desea consistencia)
