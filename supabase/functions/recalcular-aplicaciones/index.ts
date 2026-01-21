import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_WEBHOOK_URL = Deno.env.get('N8N_WEBHOOK_BASE_URL') || 'https://automatizacion-n8n.fbqqbe.easypanel.host/webhook';

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

    console.log(`Calling n8n webhook for cuenta_cobranza: ${id_cuenta_cobranza}`);

    // Call the n8n webhook from the server side (no CORS issues)
    const webhookResponse = await fetch(`${N8N_WEBHOOK_URL}/ajustaAplicacionesPagoCuentaEspecifica`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_cuenta_cobranza }),
    });

    const responseText = await webhookResponse.text();
    console.log(`Webhook response status: ${webhookResponse.status}, body: ${responseText}`);

    if (!webhookResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Webhook call failed', 
          status: webhookResponse.status,
          details: responseText 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Recálculo iniciado correctamente',
        webhookResponse: responseText 
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
