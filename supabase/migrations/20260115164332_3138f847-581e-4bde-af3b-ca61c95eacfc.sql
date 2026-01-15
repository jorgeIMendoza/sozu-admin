-- Corregir cuenta 1678: producto con tiene_metraje=true
-- El precio_final debe ser: 6.64 m² × $30,000/m² = $199,200

-- 1. Actualizar precio_final en cuentas_cobranza
UPDATE cuentas_cobranza 
SET precio_final = 199200.00,
    fecha_actualizacion = now()
WHERE id = 1678;

-- 2. Actualizar monto del enganche (20% de $199,200 = $39,840)
UPDATE acuerdos_pago 
SET monto = 39840.00,
    fecha_actualizacion = now()
WHERE id = 24860;

-- 3. Actualizar montos de las 4 parcialidades (cada una 20% de $199,200 = $39,840)
UPDATE acuerdos_pago 
SET monto = 39840.00,
    fecha_actualizacion = now()
WHERE id IN (24861, 24862, 24863, 24864);