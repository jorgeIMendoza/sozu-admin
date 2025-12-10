-- Insertar tipos de actividades en español usando OVERRIDING SYSTEM VALUE
INSERT INTO actividades (id, nombre, activo) 
OVERRIDING SYSTEM VALUE
VALUES
(1, 'CREAR', true),
(2, 'ACTUALIZAR', true),
(3, 'ELIMINAR', true),
(4, 'INICIAR_SESION', true),
(5, 'CERRAR_SESION', true),
(6, 'VER', true),
(7, 'EXPORTAR', true),
(8, 'RESTAURAR', true),
(9, 'APROBAR', true),
(10, 'RECHAZAR', true),
(11, 'ASIGNAR', true),
(12, 'DESASIGNAR', true),
(13, 'GENERAR_OFERTA', true),
(14, 'GENERAR_CONTRATO', true),
(15, 'SUBIR_DOCUMENTO', true),
(16, 'REGISTRAR_PAGO', true),
(17, 'CANCELAR', true)
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, activo = true;

-- Habilitar RLS en logs_actividad si no está habilitado
ALTER TABLE logs_actividad ENABLE ROW LEVEL SECURITY;

-- Política para permitir INSERT a usuarios autenticados
DROP POLICY IF EXISTS "Permitir inserción de logs a usuarios autenticados" ON logs_actividad;
CREATE POLICY "Permitir inserción de logs a usuarios autenticados" 
ON logs_actividad 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Política para permitir SELECT a usuarios autenticados
DROP POLICY IF EXISTS "Permitir lectura de logs a usuarios autenticados" ON logs_actividad;
CREATE POLICY "Permitir lectura de logs a usuarios autenticados" 
ON logs_actividad 
FOR SELECT 
TO authenticated 
USING (true);