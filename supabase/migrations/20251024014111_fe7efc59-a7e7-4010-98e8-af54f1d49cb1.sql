-- Eliminar el constraint existente
ALTER TABLE esquemas_pago DROP CONSTRAINT IF EXISTS chk_esq_suma_100;

-- Crear el nuevo constraint que permite suma de 0 o 100
ALTER TABLE esquemas_pago 
ADD CONSTRAINT chk_esq_suma_100 CHECK (
  (porcentaje_enganche + porcentaje_mensualidades + porcentaje_entrega) IN (0.00, 100.00)
);