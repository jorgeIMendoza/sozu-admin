-- Crear rol "Agente Interno"
INSERT INTO roles (id, nombre, activo, fecha_creacion, fecha_actualizacion) 
OVERRIDING SYSTEM VALUE
VALUES (9, 'Agente Interno', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;