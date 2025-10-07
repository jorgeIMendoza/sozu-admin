-- Crear los triggers que faltaban para asociar las funciones a las tablas

-- Trigger para agregar cónyuge en todas las cuentas cuando se actualiza id_conyuge en personas
DROP TRIGGER IF EXISTS trg_agregar_conyuge_en_todas_cuentas ON public.personas;
CREATE TRIGGER trg_agregar_conyuge_en_todas_cuentas
AFTER UPDATE OF id_conyuge ON public.personas
FOR EACH ROW
EXECUTE FUNCTION public.agregar_conyuge_en_todas_cuentas();

-- Trigger para agregar cónyuge como comprador cuando se inserta un nuevo comprador
DROP TRIGGER IF EXISTS trg_agregar_conyuge_como_comprador ON public.compradores;
CREATE TRIGGER trg_agregar_conyuge_como_comprador
AFTER INSERT ON public.compradores
FOR EACH ROW
EXECUTE FUNCTION public.agregar_conyuge_como_comprador();