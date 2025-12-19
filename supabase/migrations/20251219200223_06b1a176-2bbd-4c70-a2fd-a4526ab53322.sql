-- Corregir cuenta_cobranza 1668: precio_final debe ser 30000 * 4.60 = 138000
UPDATE cuentas_cobranza 
SET precio_final = 138000.00,
    fecha_actualizacion = NOW()
WHERE id = 1668;

-- Corregir acuerdo de pago - Enganche (5%): 138000 * 0.05 = 6900
UPDATE acuerdos_pago 
SET monto = 6900.00,
    fecha_actualizacion = NOW()
WHERE id = 24047 AND id_cuenta_cobranza = 1668;

-- Corregir acuerdo de pago - Entrega (95%): 138000 * 0.95 = 131100
UPDATE acuerdos_pago 
SET monto = 131100.00,
    fecha_actualizacion = NOW()
WHERE id = 24048 AND id_cuenta_cobranza = 1668;