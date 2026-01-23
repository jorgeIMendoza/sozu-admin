-- Fix fecha_pago for payment HSBC225217 (id: 3583)
UPDATE pagos 
SET fecha_pago = '2024-07-09'
WHERE id = 3583 AND clave_rastreo = 'HSBC225217';