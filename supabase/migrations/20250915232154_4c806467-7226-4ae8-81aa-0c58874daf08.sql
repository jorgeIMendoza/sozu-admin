-- Insertar amenidades internas que faltan
INSERT INTO amenidades (nombre, habilitar_asignar, activo) VALUES 
  ('Balcón', true, true),
  ('Área de servicio', true, true),
  ('Cuarto de servicio', true, true),
  ('Barra de Cocina', true, true),
  ('Aire acondicionado', true, true),
  ('Jacuzzi', true, true),
  ('Cuarto Flex', true, true),
  ('Walk-in-closet', true, true),
  ('Bodega interna', true, true)
ON CONFLICT (nombre) DO NOTHING;