-- Add correos jsonb column to avisos_roles_destinatarios
ALTER TABLE avisos_roles_destinatarios 
ADD COLUMN correos jsonb DEFAULT '{"destinatarios": []}'::jsonb;