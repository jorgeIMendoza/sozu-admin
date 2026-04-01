

# Fix PropertyFloorPlanButton — Corregir extracción de plano arquitectónico

## Problema
El componente `PropertyFloorPlanButton.tsx` tiene **el nombre de columna incorrecto**: usa `url_imagen` pero la tabla `modelos_planos_arquitectonicos` tiene la columna `imagen_url`. Esto causa que el query nunca retorne datos y el botón no aparezca.

Además, no filtra por `nivel` ni hace match por `departamentos` como sí lo hace el portal del cliente en `useClientePropiedadDetalle.ts` (líneas 224-242).

## Solución
Replicar la lógica exacta del portal del cliente:

**Archivo:** `src/components/admin/agent-portal/PropertyFloorPlanButton.tsx`

1. Corregir `url_imagen` → `imagen_url` en el query a `modelos_planos_arquitectonicos`
2. Agregar filtro por `nivel` (usando `numero_piso` de la propiedad)
3. Seleccionar también `departamentos` y hacer match del número de departamento extraído (eliminando prefijo de piso), igual que en el portal del cliente
4. Mantener el fallback a `edificios_niveles_planos` pero también corregir `url_imagen` → `imagen_url`
5. Para el fallback, también obtener `regiones` para futuro uso

### Lógica corregida (basada en useClientePropiedadDetalle.ts líneas 208-242):
```
1. Obtener propiedad: id_edificio_modelo, numero_piso, numero_propiedad
2. Obtener edificio_modelo: id_edificio, id_modelo
3. Extraer numero de depto (quitar prefijo de piso)
4. Query modelos_planos_arquitectonicos WHERE id_edificio_modelo AND nivel AND activo
5. Match por departamentos[] que contenga el numero de depto
6. Si hay match → usar imagen_url
7. Si no → fallback a modelos.plano_arquitectonico
8. Si no → fallback a edificios_niveles_planos por id_edificio + nivel
```

## Detalle técnico

Un solo archivo modificado: `PropertyFloorPlanButton.tsx`. Se reescribe el `queryFn` para seguir exactamente la misma cadena de resolución que `useClientePropiedadDetalle.ts`.

