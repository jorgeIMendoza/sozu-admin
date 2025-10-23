-- Corregir función actualizar_estatus_reservas para manejar correctamente el estatus "En progreso"
CREATE OR REPLACE FUNCTION public.actualizar_estatus_reservas()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Actualizar a "Pagado" (id=2) cuando el acuerdo de pago está completado
  UPDATE reservas r
  SET id_estatus_reserva = 2
  FROM acuerdos_pago ap
  WHERE r.id_acuerdo_pago = ap.id
    AND ap.pago_completado = true
    AND r.id_estatus_reserva = 1  -- Solo si está en "Agendada"
    AND r.activo = true;

  -- Actualizar a "En progreso" (id=3) cuando la fecha/hora actual está dentro de la duración de la reserva
  UPDATE reservas r
  SET id_estatus_reserva = 3
  FROM espacios_reservables_edificio ere
  WHERE r.id_espacio_reservable_edificio = ere.id
    AND r.id_estatus_reserva = 2  -- Solo si está en "Pagado"
    AND r.activo = true
    AND CONCAT(r.fecha_reserva::text, ' ', r.hora_reserva)::timestamp <= NOW()
    AND (CONCAT(r.fecha_reserva::text, ' ', r.hora_reserva)::timestamp + 
         COALESCE(ere.duracion_reserva, INTERVAL '1 hour')) > NOW();

  -- Actualizar a "Terminada" (id=4) cuando termina la duración de la reserva
  UPDATE reservas r
  SET id_estatus_reserva = 4
  FROM espacios_reservables_edificio ere
  WHERE r.id_espacio_reservable_edificio = ere.id
    AND r.id_estatus_reserva = 3  -- Solo si está en "En progreso"
    AND r.activo = true
    AND (CONCAT(r.fecha_reserva::text, ' ', r.hora_reserva)::timestamp + 
         COALESCE(ere.duracion_reserva, INTERVAL '1 hour')) <= NOW();
END;
$function$;