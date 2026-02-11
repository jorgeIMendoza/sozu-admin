
ALTER TABLE avisos_roles_destinatarios RENAME COLUMN aviso_id TO id_aviso;
ALTER TABLE avisos_roles_destinatarios RENAME COLUMN rol_id TO id_rol;

ALTER TABLE avisos_ejecuciones RENAME COLUMN aviso_id TO id_aviso;
ALTER TABLE avisos_ejecuciones ALTER COLUMN ejecutado_por TYPE text USING ejecutado_por::text;
