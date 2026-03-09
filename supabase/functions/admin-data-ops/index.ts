import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { operation } = await req.json();

    // Fix firma estado
    if (operation === 'fix_firma') {
      const { error } = await supabase
        .from('firmas_digitales')
        .update({ estado: 'enviado' })
        .eq('id', 20);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: 'Firma 20 reset to enviado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Link documents to CC 1748
    if (operation === 'link_docs') {
      const bucketName = 'cuentas_canceladas_docs';
      const files = [
        { name: '708 INE.pdf', tipo: 18 },
        { name: '708 Acta de Nacimiento.pdf', tipo: 19 },
        { name: '708 Contrato.pdf', tipo: 42 },
        { name: '708 Copia Certificada Convenio Terminacion.pdf', tipo: 39 },
        { name: '708 Acuse Cheque.pdf', tipo: 31 },
      ];

      const results = [];
      for (const file of files) {
        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(file.name);

        const { data, error } = await supabase
          .from('documentos')
          .insert({
            id_cuenta_cobranza: 1748,
            id_tipo_documento: file.tipo,
            url: publicUrl,
            id_estatus_verificacion: 2,
            es_draft: false,
            activo: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        results.push({ doc_id: data.id, tipo: file.tipo, file: file.name });
      }

      // Update CC with convenio URL as evidencia_cancelacion
      const convenioUrl = supabase.storage
        .from(bucketName)
        .getPublicUrl('708 Copia Certificada Convenio Terminacion.pdf').data.publicUrl;
      
      const { error: ccErr } = await supabase
        .from('cuentas_cobranza')
        .update({ url_evidencia_cancelacion: convenioUrl })
        .eq('id', 1748);
      if (ccErr) throw ccErr;

      return new Response(JSON.stringify({ success: true, docs: results, convenio_url: convenioUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'unknown operation' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
