
-- Account 1677: Delete wrong email entry
DELETE FROM comisionistas 
WHERE id_cuenta_cobranza = 1677 AND email_usuario = 'vivalta@vivaltainmobiliaria.com';

-- Account 1677: Reactivate correct email with proper percentage
UPDATE comisionistas 
SET activo = true, porcentaje_comision = 4.0000, fecha_actualizacion = now()
WHERE id_cuenta_cobranza = 1677 AND email_usuario = 'contacto@vivaltainmobiliaria.com';

-- Account 1682: Fix Trust email
UPDATE comisionistas 
SET email_usuario = 'bb@trustreal.mx', fecha_actualizacion = now()
WHERE id_cuenta_cobranza = 1682 AND email_usuario = 'trust@trustreal.mx';
