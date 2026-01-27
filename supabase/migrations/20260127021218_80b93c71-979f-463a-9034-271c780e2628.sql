-- Modificar la columna para soportar 4 decimales
ALTER TABLE public.comisionistas
ALTER COLUMN porcentaje_comision TYPE numeric(7, 4);

-- Eliminar la restricción existente
ALTER TABLE public.comisionistas
DROP CONSTRAINT IF EXISTS chk_comisionistas_porcentaje;

-- Crear nueva restricción con 4 decimales
ALTER TABLE public.comisionistas
ADD CONSTRAINT chk_comisionistas_porcentaje CHECK (
    (porcentaje_comision >= (0)::numeric)
    AND (porcentaje_comision <= (100)::numeric)
    AND (porcentaje_comision = round(porcentaje_comision, 4))
);