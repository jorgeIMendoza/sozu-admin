-- Fix emiliano.ma@hotmail.com: set rol_id to 3 (Agente Inmobiliario) and normalize email case
UPDATE usuarios 
SET rol_id = 3, email = LOWER(TRIM(email))
WHERE email ILIKE 'emiliano.ma@hotmail.com';