
# Plan: Corregir Background Verde para Cuentas Completamente Pagadas

## Problema Identificado

El fondo verde de las filas completamente pagadas tiene una condición diferente a la del icono del checkmark verde.

### Condición actual del BACKGROUND (línea 1448-1454):
```tsx
cuenta.restante <= 0.01 && 
!cuenta.motivo_cancelacion && 
cuenta.tiene_acuerdos &&           // <- Requiere acuerdos
!cuenta.tiene_multas_pendientes && 
cuenta.precio_final > 0            // <- Requiere precio > 0
```

### Condición actual del ICONO CHECKMARK (línea 1686):
```tsx
cuenta.restante <= 0.01 && 
!cuenta.motivo_cancelacion && 
!cuenta.tiene_multas_pendientes && 
(cuenta.tiene_acuerdos || cuenta.precio_final === 0)  // <- Ya corregida
```

Las cuentas 1686, 1687, etc. tienen `precio_final = 0`, por lo que:
- El icono verde SÍ aparece (porque `cuenta.precio_final === 0` es `true`)
- El fondo verde NO aparece (porque `cuenta.precio_final > 0` es `false`)

---

## Solución

Unificar la condición del background con la del icono checkmark.

### Cambio en `src/pages/admin/Pagos.tsx`

**Líneas 1448-1454 - Antes:**
```tsx
<TableRow key={cuenta.id} className={
  cuenta.id_estatus_disponibilidad === 11
    ? "bg-amber-50 dark:bg-amber-950/30"
    : cuenta.restante <= 0.01 && !cuenta.motivo_cancelacion && cuenta.tiene_acuerdos && !cuenta.tiene_multas_pendientes && cuenta.precio_final > 0 
      ? "bg-green-50 dark:bg-green-950/20" 
      : ""
}>
```

**Líneas 1448-1454 - Después:**
```tsx
<TableRow key={cuenta.id} className={
  cuenta.id_estatus_disponibilidad === 11
    ? "bg-amber-50 dark:bg-amber-950/30"
    : cuenta.restante <= 0.01 && !cuenta.motivo_cancelacion && !cuenta.tiene_multas_pendientes && (cuenta.tiene_acuerdos || cuenta.precio_final === 0)
      ? "bg-green-50 dark:bg-green-950/20" 
      : ""
}>
```

---

## Resumen del Cambio

| Elemento | Condición Anterior | Nueva Condición |
|----------|-------------------|-----------------|
| Fondo verde fila | `tiene_acuerdos && precio_final > 0` | `tiene_acuerdos \|\| precio_final === 0` |
| Icono checkmark | Ya corregido previamente | Sin cambios |

Esto asegura que las cuentas con `precio_final = 0` y `restante <= 0.01` tengan tanto el icono verde como el fondo verde.
