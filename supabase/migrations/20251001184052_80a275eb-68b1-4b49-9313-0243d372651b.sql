-- Trigger para actualizar precio_m2_actual en proyectos cuando una propiedad se aparta
CREATE OR REPLACE FUNCTION actualizar_precio_m2_proyecto()
RETURNS TRIGGER AS $$
DECLARE
    v_precio_final NUMERIC;
    v_m2_escriturables NUMERIC;
    v_precio_por_m2_actual NUMERIC;
    v_precio_m2_actual_proyecto NUMERIC;
    v_id_proyecto INTEGER;
BEGIN
    -- Solo ejecutar cuando el estatus cambia a "Apartado" (id=4)
    IF NEW.id_estatus_disponibilidad = 4 AND (OLD.id_estatus_disponibilidad IS NULL OR OLD.id_estatus_disponibilidad != 4) THEN
        
        -- Obtener m2_escriturables de la propiedad
        SELECT m2_escriturables INTO v_m2_escriturables
        FROM propiedades
        WHERE id = NEW.id;
        
        -- Obtener precio_final de la cuenta de cobranza asociada
        SELECT cc.precio_final, er.id_proyecto
        INTO v_precio_final, v_id_proyecto
        FROM cuentas_cobranza cc
        JOIN ofertas o ON cc.id_oferta = o.id
        JOIN propiedades p ON o.id_propiedad = p.id
        JOIN entidades_relacionadas er ON p.id_entidad_relacionada_dueno = er.id
        WHERE o.id_propiedad = NEW.id
          AND cc.activo = true
        ORDER BY cc.fecha_creacion DESC
        LIMIT 1;
        
        -- Validar que tengamos los datos necesarios
        IF v_precio_final IS NOT NULL AND v_m2_escriturables IS NOT NULL AND v_m2_escriturables > 0 AND v_id_proyecto IS NOT NULL THEN
            
            -- Calcular precio por m2 actual
            v_precio_por_m2_actual := v_precio_final / v_m2_escriturables;
            
            -- Obtener el precio_m2_actual actual del proyecto
            SELECT precio_m2_actual INTO v_precio_m2_actual_proyecto
            FROM proyectos
            WHERE id = v_id_proyecto;
            
            -- Si el precio_m2_actual del proyecto es NULL o menor al recién calculado, actualizarlo
            IF v_precio_m2_actual_proyecto IS NULL OR v_precio_m2_actual_proyecto < v_precio_por_m2_actual THEN
                UPDATE proyectos
                SET precio_m2_actual = v_precio_por_m2_actual,
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = v_id_proyecto;
                
                RAISE NOTICE 'Actualizado precio_m2_actual del proyecto % a %', v_id_proyecto, v_precio_por_m2_actual;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger
DROP TRIGGER IF EXISTS trigger_actualizar_precio_m2_proyecto ON propiedades;
CREATE TRIGGER trigger_actualizar_precio_m2_proyecto
AFTER UPDATE OF id_estatus_disponibilidad ON propiedades
FOR EACH ROW
EXECUTE FUNCTION actualizar_precio_m2_proyecto();