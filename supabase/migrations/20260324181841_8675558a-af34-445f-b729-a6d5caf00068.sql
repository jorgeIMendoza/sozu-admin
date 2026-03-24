-- Delete all references to mj@trustreal.mx before deleting the usuario
DELETE FROM logs_actividad WHERE usuario_id = 'mj@trustreal.mx';
DELETE FROM proyectos_acceso WHERE usuario_id = 'mj@trustreal.mx';
DELETE FROM usuarios WHERE email = 'mj@trustreal.mx';