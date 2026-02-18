
# Plan: RPC para Inventario Global

## Problema actual

La vista hace **5 queries secuenciales** (waterfall) desde el cliente:
1. Proyectos con edificios, modelos y propiedades (query pesada con JOINs anidados)
2. Esquemas de pago por proyecto
3. Imagenes de propiedades (en batches de 500)
4. Bodegas por propiedad (en batches de 500)
5. Estacionamientos por propiedad (en batches de 500)

Cada query espera a la anterior, causando ~1 minuto de carga total.

## Solucion

Crear **una sola funcion RPC de Postgres** (`get_inventario_disponible`) que devuelva todas las propiedades disponibles ya aplanadas con toda la info necesaria en una sola llamada. El front solo renderiza.

## Paso 1: Crear la migracion SQL

Funcion `get_inventario_disponible` que recibe:
- `p_accessible_project_ids` (int[] nullable) - control de acceso por proyecto

Retorna un JSON array donde cada fila tiene:
- Datos de propiedad: id, numero_propiedad, numero_piso, precio_lista, m2_interiores, m2_exteriores
- Datos de proyecto: proyecto_id, proyecto_nombre
- Datos de edificio: edificio_nombre
- Datos de modelo: modelo_id, modelo_nombre, numero_recamaras, numero_completo_banos, numero_medio_bano
- Conteos: bodegas_count, estacionamientos_count
- Tipos de estacionamiento: estacionamientos_tipos (text[])
- Imagenes de propiedad: propiedad_imagenes (jsonb[]) - URLs de imagenes propias
- Imagenes de modelo (fallback): modelo_imagenes (jsonb[]) - URLs de imagenes con ver_como_imagen_de_propiedad
- Esquemas de pago del proyecto: esquemas_pago (jsonb[])

La funcion filtra solo:
- `proyectos.activo = true AND proyectos.publicar = true`
- `propiedades.id_estatus_disponibilidad = 2` (disponible)

Todo en un solo query con JOINs eficientes, subqueries laterales para conteos y arrays.

## Paso 2: Hook React

Crear `src/hooks/useInventarioDisponible.ts`:
- Llama a `supabase.rpc('get_inventario_disponible', { p_accessible_project_ids })`
- Usa `useProjectAccess()` para el control de acceso
- Retorna los datos ya listos para renderizar

## Paso 3: Refactorizar InventarioGlobal.tsx

Reemplazar las 5 queries actuales por una sola llamada al nuevo hook. La logica de:
- Aplanar propiedades (ya viene aplanado del RPC)
- Mapear imagenes (ya vienen incluidas)
- Mapear bodegas/estacionamientos (ya vienen como conteos)
- Esquemas de pago (ya vienen por proyecto)
- Shuffling aleatorio (se mantiene en el front)
- Filtros (se mantienen en el front con useMemo)

---

## Seccion Tecnica

### SQL de la funcion RPC

```text
CREATE OR REPLACE FUNCTION get_inventario_disponible(
  p_accessible_project_ids int[] DEFAULT NULL
)
RETURNS jsonb AS $$
  -- Single query joining:
  -- proyectos -> edificios -> edificios_modelos -> modelos -> propiedades
  -- LEFT JOIN lateral para:
  --   bodegas count
  --   estacionamientos count + tipos
  --   multimedias_propiedad (imagenes)
  --   multimedias_modelo (imagenes fallback)
  --   esquemas_pago del proyecto
  -- WHERE propiedades.id_estatus_disponibilidad = 2
  --   AND proyectos.activo = true AND proyectos.publicar = true
  --   AND (p_accessible_project_ids IS NULL OR proyectos.id = ANY(p_accessible_project_ids))
$$ LANGUAGE sql STABLE;
```

### Estructura del hook

```text
useInventarioDisponible({ enabled })
  -> useProjectAccess()
  -> supabase.rpc('get_inventario_disponible', { p_accessible_project_ids })
  -> returns { propiedades, isLoading }
```

### Cambios en InventarioGlobal.tsx

- Eliminar las 5 queries existentes (lineas 35-170)
- Eliminar los useMemo de mapeo (bodegasMap, estacionamientosMap, propertyImagesMap)
- Usar el hook directo, mantener solo los useMemo de filtrado y el shuffle
- Los esquemas de pago vienen incluidos en cada propiedad (agrupados por proyecto)

### Resultado esperado

| Metrica | Antes | Despues |
|---------|-------|---------|
| Queries al servidor | 5+ (waterfall) | 1 |
| Tiempo de carga | ~60 segundos | < 2 segundos |
| Datos procesados en cliente | Mucho (maps, batches) | Minimo (solo filtros/shuffle) |
