

## Agregar disclaimer cuando el prospecto no tiene RFC valido

### Problema
Actualmente, cuando se genera una oferta y el prospecto no tiene un RFC valido, la seccion de datos bancarios se omite silenciosamente. Solo existe un disclaimer para el caso de "sin plan de pago seleccionado", pero no para "sin RFC valido".

### Cambios

#### 1. `src/components/admin/NewOfferDialog.tsx`
- Despues del disclaimer actual de esquema de pago (~linea 955), agregar una segunda condicion: si el prospecto no tiene RFC valido, mostrar un toast indicando que la oferta se genero sin datos bancarios por falta de RFC.
- Se importara `isValidRFC` desde `@/utils/fiscalDataValidation` y se evaluara el RFC del lead.
- Si ambas condiciones se cumplen (sin esquema Y sin RFC), se mostrara un solo toast combinado en lugar de dos separados.

Logica:
```
const missingScheme = !result.schemeId;
const missingRFC = !isValidRFC(leadRfc);

if (missingScheme || missingRFC) {
  const reasons = [];
  if (missingRFC) reasons.push("el prospecto no tiene un RFC valido");
  if (missingScheme) reasons.push("no se selecciono un plan de pago");
  
  toast({
    title: "Aviso: Sin datos bancarios",
    description: `La oferta se genero sin la seccion de datos bancarios porque ${reasons.join(" y ")}.`,
    duration: 8000,
  });
}
```

#### 2. `src/components/admin/NewProductOfferDialog.tsx`
- Mismo cambio: agregar validacion de RFC del prospecto y combinar ambos disclaimers en uno solo con la misma logica.

### Resumen
Se reemplaza el disclaimer actual (solo plan de pago) por uno inteligente que cubre ambos casos (RFC invalido y/o sin plan de pago), mostrando al usuario la razon exacta por la que no se incluyen los datos bancarios.

