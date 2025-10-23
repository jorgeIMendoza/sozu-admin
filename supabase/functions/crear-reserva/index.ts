import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      id_cuenta_mantenimiento,
      id_espacio_reservable_edificio,
      id_persona_que_reserva,
      fecha_reserva,
      hora_reserva,
      costo_final,
    } = await req.json();

    // Validar datos requeridos
    if (!id_cuenta_mantenimiento || !id_espacio_reservable_edificio || !id_persona_que_reserva || !fecha_reserva || !hora_reserva) {
      return new Response(
        JSON.stringify({ error: 'Faltan datos requeridos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Obtener el máximo orden existente para esta cuenta de cobranza
    const { data: maxOrdenData, error: maxOrdenError } = await supabase
      .from('acuerdos_pago')
      .select('orden')
      .eq('id_cuenta_cobranza', id_cuenta_mantenimiento)
      .order('orden', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxOrdenError) {
      console.error('Error al obtener max orden:', maxOrdenError);
      return new Response(
        JSON.stringify({ error: maxOrdenError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const nuevoOrden = (maxOrdenData?.orden || 0) + 1;

    // Usar una transacción para crear acuerdo_pago y reserva
    const { data: acuerdo, error: acuerdoError } = await supabase
      .from('acuerdos_pago')
      .insert({
        id_cuenta_cobranza: id_cuenta_mantenimiento,
        id_concepto: 14,
        monto: costo_final,
        fecha_pago: fecha_reserva,
        orden: nuevoOrden,
      })
      .select()
      .single();

    if (acuerdoError) {
      console.error('Error al crear acuerdo_pago:', acuerdoError);
      return new Response(
        JSON.stringify({ error: acuerdoError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Crear la reserva
    const { data: reserva, error: reservaError } = await supabase
      .from('reservas')
      .insert({
        id_acuerdo_pago: acuerdo.id,
        id_espacio_reservable_edificio: parseInt(id_espacio_reservable_edificio),
        fecha_reserva,
        hora_reserva,
        costo_final,
        id_estatus_reserva: 1,
        id_persona_que_reserva: parseInt(id_persona_que_reserva),
      })
      .select()
      .single();

    if (reservaError) {
      console.error('Error al crear reserva:', reservaError);
      
      // Rollback: eliminar el acuerdo_pago creado
      await supabase
        .from('acuerdos_pago')
        .delete()
        .eq('id', acuerdo.id);

      return new Response(
        JSON.stringify({ error: reservaError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: reserva }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error general:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
