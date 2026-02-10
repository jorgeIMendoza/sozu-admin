

## Plan: Ocultar boton "Recalcular" cuando no hay acuerdos pendientes

### Problema
El boton "Recalcular Aplicaciones" aparece en cuentas como CM-1366 donde hay saldo a favor ($27,900) pero todos los acuerdos ya estan completamente pagados. No tiene sentido recalcular si no hay acuerdos pendientes que puedan recibir fondos.

### Solucion
Cambiar la condicion de visibilidad del boton para que ademas de verificar que hay excedente, tambien verifique que existen acuerdos sin pagar.

### Cambio

**Archivo: `src/pages/admin/DetalleCuentaMantenimiento.tsx`**

Linea 799 - Cambiar la condicion del boton de:

```tsx
{excedente > 0.01 && (
```

A:

```tsx
{excedente > 0.01 && acuerdosData?.some(a => !a.pago_completado) && (
```

Esto asegura que el boton solo aparece cuando:
1. Hay dinero pagado sin aplicar (excedente > $0.01)
2. Existen acuerdos pendientes donde se pueda redistribuir ese dinero

En el caso de CM-1366 (todos los acuerdos pagados), el boton se oculta. En CM-1365 (acuerdos sin pagar con fondos flotando), el boton sigue visible.

