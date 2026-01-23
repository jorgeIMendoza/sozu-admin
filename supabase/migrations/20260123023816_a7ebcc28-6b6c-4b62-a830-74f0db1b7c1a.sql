-- Corregir URL del CEP para que apunte al archivo en el proyecto público
UPDATE pagos 
SET url_cep = 'https://sozu-admin.lovable.app/ceps/CEP-20240410-HSBC086392.pdf',
    url_recibo = 'https://sozu-admin.lovable.app/ceps/CEP-20240410-HSBC086392.pdf',
    fecha_actualizacion = CURRENT_TIMESTAMP
WHERE id = 1432 AND clave_rastreo = 'HSBC086392';