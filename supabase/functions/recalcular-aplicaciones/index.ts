import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { id_cuenta_cobranza } = await req.json();

    if (!id_cuenta_cobranza) {
      return new Response(
        JSON.stringify({ error: 'id_cuenta_cobranza is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Recalculando aplicaciones para cuenta_cobranza: ${id_cuenta_cobranza}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get all acuerdos_pago for this cuenta, ordered by orden
    const { data: acuerdos, error: acuerdosError } = await supabase
      .from('acuerdos_pago')
      .select('id, orden, monto, pago_completado, id_concepto')
      .eq('id_cuenta_cobranza', id_cuenta_cobranza)
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (acuerdosError) {
      console.error('Error fetching acuerdos:', acuerdosError);
      throw acuerdosError;
    }

    console.log(`Found ${acuerdos?.length || 0} acuerdos`);

    // 2. Get all pagos for this cuenta
    const { data: pagos, error: pagosError } = await supabase
      .from('pagos')
      .select('id, monto, fecha_pago')
      .eq('id_cuenta_cobranza', id_cuenta_cobranza)
      .eq('activo', true)
      .order('fecha_pago', { ascending: true });

    if (pagosError) {
      console.error('Error fetching pagos:', pagosError);
      throw pagosError;
    }

    console.log(`Found ${pagos?.length || 0} pagos`);

    // 3. Get current aplicaciones
    const { data: currentAplicaciones, error: aplicacionesError } = await supabase
      .from('aplicaciones_pago')
      .select('id, id_pago, id_acuerdo_pago, monto')
      .in('id_acuerdo_pago', acuerdos?.map(a => a.id) || [])
      .eq('activo', true)
      .eq('es_multa', false);

    if (aplicacionesError) {
      console.error('Error fetching aplicaciones:', aplicacionesError);
      throw aplicacionesError;
    }

    console.log(`Found ${currentAplicaciones?.length || 0} current aplicaciones`);

    // 4. Calculate total available from payments
    let totalDisponible = pagos?.reduce((sum, p) => sum + Number(p.monto), 0) || 0;
    console.log(`Total disponible from payments: ${totalDisponible}`);

    // 5. Delete all current non-multa aplicaciones
    if (currentAplicaciones && currentAplicaciones.length > 0) {
      const { error: deleteError } = await supabase
        .from('aplicaciones_pago')
        .delete()
        .in('id', currentAplicaciones.map(a => a.id));

      if (deleteError) {
        console.error('Error deleting aplicaciones:', deleteError);
        throw deleteError;
      }
      console.log(`Deleted ${currentAplicaciones.length} aplicaciones`);
    }

    // 6. Redistribute payments to acuerdos in order
    const newAplicaciones: Array<{
      id_pago: number;
      id_acuerdo_pago: number;
      monto: number;
      activo: boolean;
      es_multa: boolean;
    }> = [];

    // Track remaining amount per payment
    const paymentRemaining: Map<number, number> = new Map();
    pagos?.forEach(p => paymentRemaining.set(p.id, Number(p.monto)));

    // Track amount needed per acuerdo
    const acuerdosPendientes = acuerdos?.map(a => ({
      id: a.id,
      montoNecesario: Number(a.monto),
      montoPagado: 0
    })) || [];

    // Apply payments in order
    for (const acuerdo of acuerdosPendientes) {
      if (acuerdo.montoNecesario <= 0) continue;

      for (const pago of (pagos || [])) {
        const remaining = paymentRemaining.get(pago.id) || 0;
        if (remaining <= 0) continue;

        const necesario = acuerdo.montoNecesario - acuerdo.montoPagado;
        if (necesario <= 0) break;

        const aAplicar = Math.min(remaining, necesario);
        
        // Only create application if amount is significant (> 0.01 to avoid constraint violations)
        if (aAplicar >= 0.01) {
          // Round to 2 decimal places to avoid floating point issues
          const montoRedondeado = Math.round(aAplicar * 100) / 100;
          
          if (montoRedondeado > 0) {
            newAplicaciones.push({
              id_pago: pago.id,
              id_acuerdo_pago: acuerdo.id,
              monto: montoRedondeado,
              activo: true,
              es_multa: false
            });

            paymentRemaining.set(pago.id, remaining - montoRedondeado);
            acuerdo.montoPagado += montoRedondeado;
          }
        }
      }
    }

    console.log(`Creating ${newAplicaciones.length} new aplicaciones`);

    // 7. Insert new aplicaciones in batches
    if (newAplicaciones.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < newAplicaciones.length; i += batchSize) {
        const batch = newAplicaciones.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('aplicaciones_pago')
          .insert(batch);

        if (insertError) {
          console.error('Error inserting aplicaciones batch:', insertError);
          throw insertError;
        }
      }
    }

    // 8. Update pago_completado for each acuerdo
    for (const acuerdo of acuerdosPendientes) {
      const isComplete = Math.abs(acuerdo.montoPagado - acuerdo.montoNecesario) < 0.01;
      
      const { error: updateError } = await supabase
        .from('acuerdos_pago')
        .update({ pago_completado: isComplete })
        .eq('id', acuerdo.id);

      if (updateError) {
        console.error(`Error updating acuerdo ${acuerdo.id}:`, updateError);
      }
    }

    console.log('Recálculo completado exitosamente');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Recálculo completado exitosamente',
        aplicacionesCreadas: newAplicaciones.length,
        acuerdosActualizados: acuerdosPendientes.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in recalcular-aplicaciones:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
