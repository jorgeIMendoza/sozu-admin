
## Plan: Eliminar propiedades y edificio de Mutuo Vive

### Objetivo
Eliminar las 164 propiedades del edificio inactivo (ID 3809) del proyecto Mutuo Vive (ID 1746) y el propio edificio, para poder hacer una carga limpia de nuevas propiedades.

### Datos verificados
- Las 164 propiedades no tienen dependencias criticas (0 ofertas, 0 cuentas, 0 estacionamientos, 0 bodegas, 0 documentos)
- Solo existe **164 registros en `multimedias_propiedad`** que se eliminaran primero
- El edificio 3809 tiene 3 relaciones en `edificios_modelos` (IDs: 2607, 2608, 2609)
- El edificio 4756 (activo, sin propiedades) se mantiene para la nueva carga

### Secuencia de eliminacion

Se ejecutaran las siguientes operaciones en orden:

1. **Eliminar multimedias de propiedades** - Borrar los 164 registros de `multimedias_propiedad` asociados
2. **Eliminar las 164 propiedades** - Borrar de la tabla `propiedades` donde `id_edificio_modelo` IN (2607, 2608, 2609)
3. **Eliminar relaciones edificio-modelo** - Borrar de `edificios_modelos` donde `id_edificio = 3809`
4. **Eliminar el edificio 3809** - Borrar de `edificios` donde `id = 3809`

### Detalle tecnico

```sql
-- Paso 1: Eliminar multimedias
DELETE FROM multimedias_propiedad 
WHERE id_propiedad IN (
  SELECT id FROM propiedades WHERE id_edificio_modelo IN (2607, 2608, 2609)
);

-- Paso 2: Eliminar propiedades
DELETE FROM propiedades WHERE id_edificio_modelo IN (2607, 2608, 2609);

-- Paso 3: Eliminar relaciones edificio-modelo
DELETE FROM edificios_modelos WHERE id_edificio = 3809;

-- Paso 4: Eliminar edificio
DELETE FROM edificios WHERE id = 3809;
```

### Resultado esperado
- El proyecto Mutuo Vive quedara con el edificio activo (ID 4756) sin propiedades, listo para recibir la nueva carga
- El conteo de propiedades del proyecto pasara de 164 a 0
