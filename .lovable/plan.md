

## Regenerar acuerdos de pago para cuenta 1743

### Resumen

La cuenta 1743 (oferta 1790, precio $5,853,818.20) tiene actualmente 3 acuerdos que no coinciden con el esquema de pago 963. Se necesita desactivar los acuerdos incorrectos y crear los correctos.

### Estado actual vs esperado

```text
ACTUAL:
  Orden 1: Apartado     $20,000.00      (pagado) -- SE RESPETA
  Orden 2: Enganche     $272,690.91              -- DESACTIVAR
  Orden 3: Entrega      $5,561,127.29            -- DESACTIVAR
  Total: $5,853,818.20

ESPERADO (esquema 963):
  Base post-apartado: $5,833,818.20
  Orden 1:  Apartado     $20,000.00      (pagado, sin cambio)
  Orden 2:  Enganche     $291,690.91     (5%)
  Orden 3-50: 48 Parcialidades          (28.90% = $1,685,973.46)
              47 x $35,124.45 + 1 x $35,124.31 = $1,685,973.46
  Orden 51: Entrega      $3,856,153.83   (66.10%)
  Total: $5,853,818.20
```

### Verificacion de cuadre

- Apartado: $20,000.00
- Enganche: $291,690.91
- Parcialidades: 47 x $35,124.45 + $35,124.31 = $1,685,973.46
- Entrega: $3,856,153.83
- **Suma: $5,853,818.20** (cuadra con precio_final)

### SQL a ejecutar (vía migration tool, en 2 pasos)

**Paso 1: Desactivar acuerdos incorrectos**

```sql
UPDATE acuerdos_pago 
SET activo = false 
WHERE id IN (25308, 25309);
```

**Paso 2: Insertar 50 nuevos acuerdos**

```sql
INSERT INTO acuerdos_pago (id_cuenta_cobranza, id_concepto, orden, monto, pago_completado, activo)
VALUES
  -- Enganche (concepto 2)
  (1743, 2, 2, 291690.91, false, true),
  -- 47 Parcialidades de $35,124.45 (concepto 5, ordenes 3-49)
  (1743, 5, 3, 35124.45, false, true),
  (1743, 5, 4, 35124.45, false, true),
  (1743, 5, 5, 35124.45, false, true),
  -- ... (ordenes 6-49, mismo monto)
  -- Parcialidad 48 ajustada (orden 50)
  (1743, 5, 50, 35124.31, false, true),
  -- Entrega (concepto 3, orden 51)
  (1743, 3, 51, 3856153.83, false, true);
```

### Notas

- El apartado (acuerdo 25307, orden 1) no se toca ya que tiene un pago aplicado de $20,000
- Los acuerdos 25308 y 25309 no tienen aplicaciones de pago, se pueden desactivar sin riesgo
- La ultima parcialidad se ajusta en centavos para que el total cuadre exactamente
