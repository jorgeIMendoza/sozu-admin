
# Plan: Habilitar ofertas de productos para propiedades "Disponible" sin opción de comprador actual

## Resumen

Se habilitará el botón "Generar oferta de productos/servicios" para propiedades con estatus **"Disponible"**, pero ocultando automáticamente la opción "Comprador actual" ya que no existe un comprador asociado a la propiedad en ese estado.

---

## Cambios a Realizar

### 1. Habilitar el botón para estatus "Disponible"
**Archivo**: `src/pages/admin/Propiedades.tsx`

Agregar `"Disponible"` a la condición que controla la visibilidad del botón:

```typescript
// Líneas ~4681-4685: Agregar "Disponible" a la lista
(property.disponibilidad === "Disponible" ||
 property.disponibilidad === "Apartado" || 
 property.disponibilidad === "Vendido" || 
 property.disponibilidad === "Pagada completamente" ||
 property.disponibilidad === "En escrituración" ||
 property.disponibilidad === "Entregado")
```

---

### 2. Ocultar checkbox "Comprador actual" cuando es "Disponible"
**Archivo**: `src/components/admin/NewProductOfferDialog.tsx`

**Cambio A - Inicializar estado correctamente:**
Cuando el dialog se abre, si la propiedad está en "Disponible", establecer `useCurrentBuyer` en `false` y `showProspectSearch` en `true` automáticamente:

```typescript
// useEffect de reset (~líneas 171-198)
useEffect(() => {
  if (open) {
    const isDisponible = property?.disponibilidad === "Disponible";
    setUseCurrentBuyer(!isDisponible); // false si es Disponible
    setShowProspectSearch(isDisponible); // true si es Disponible
    // ... resto del reset
  }
}, [open, form, property?.disponibilidad]);
```

**Cambio B - Ocultar el checkbox en el UI:**
Solo mostrar el checkbox cuando la propiedad NO está en "Disponible":

```typescript
// Líneas ~1084-1093: Agregar condición
{property?.disponibilidad !== "Disponible" && (
  <div className="flex items-center space-x-2">
    <Checkbox
      id="comprador-actual"
      checked={useCurrentBuyer}
      onCheckedChange={handleCheckboxChange}
    />
    <Label htmlFor="comprador-actual" className="cursor-pointer">
      Comprador actual
    </Label>
  </div>
)}
```

---

## Flujo Resultante

```text
┌─────────────────────────────────────────────────────┐
│           Propiedad con estatus                     │
└───────────────────────┬─────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
   ┌──────▼──────┐           ┌────────▼────────┐
   │ "Disponible" │           │  Otros estatus  │
   └──────┬──────┘           │  (Apartado, etc) │
          │                   └────────┬────────┘
          │                            │
┌─────────▼─────────┐      ┌───────────▼───────────┐
│ Sin checkbox de   │      │ Checkbox "Comprador   │
│ "Comprador actual"│      │ actual" visible       │
│ Inicia en búsqueda│      │ Puede elegir entre    │
│ de prospecto      │      │ actual o buscar       │
└───────────────────┘      └───────────────────────┘
```

---

## Archivos Afectados

| Archivo | Cambio |
|---------|--------|
| `src/pages/admin/Propiedades.tsx` | Agregar "Disponible" a condición de visibilidad del botón |
| `src/components/admin/NewProductOfferDialog.tsx` | Inicializar estado sin comprador actual + ocultar checkbox |

---

## Detalles Técnicos

- El query `currentBuyerData` no se ejecutará cuando no hay `cuenta_cobranza_id` (lo cual es normal para propiedades "Disponible")
- El formulario funcionará correctamente con búsqueda de prospecto o ingreso manual de datos
- No se requieren cambios en la base de datos ni en Edge Functions
