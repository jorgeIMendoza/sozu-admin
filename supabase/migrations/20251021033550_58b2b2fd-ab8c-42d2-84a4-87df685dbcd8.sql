-- Corrección de Cuenta 57: Actualizar precio_final y eliminar acuerdos incorrectos
-- Paso 1: Actualizar precio_final en cuenta 57
UPDATE cuentas_cobranza 
SET precio_final = 2850890.80,
    fecha_actualizacion = CURRENT_TIMESTAMP
WHERE id = 57;

-- Paso 2: Eliminar aplicaciones de pago relacionadas con los acuerdos de cuenta 57
DELETE FROM aplicaciones_pago
WHERE id_acuerdo_pago IN (
  SELECT id FROM acuerdos_pago WHERE id_cuenta_cobranza = 57
);

-- Paso 3: Eliminar acuerdos de pago incorrectos de cuenta 57
DELETE FROM acuerdos_pago 
WHERE id_cuenta_cobranza = 57;