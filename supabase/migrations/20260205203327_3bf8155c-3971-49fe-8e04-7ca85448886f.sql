-- Regenerar el campo 'orden' de los submenus para que sea relativo a cada menu padre
-- Ejemplo: Menu "Mantenimientos" tendrá submenus con orden 1, 2, 3...
--          Menu "Notarios" tendrá submenus con orden 1, 2, 3...

WITH ranked_submenus AS (
  SELECT 
    id,
    menu_id,
    ROW_NUMBER() OVER (PARTITION BY menu_id ORDER BY orden NULLS LAST, id) as new_orden
  FROM submenus
  WHERE activo = true
)
UPDATE submenus s
SET orden = rs.new_orden
FROM ranked_submenus rs
WHERE s.id = rs.id;