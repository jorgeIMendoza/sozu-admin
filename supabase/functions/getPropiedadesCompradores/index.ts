import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Campos específicos de persona a retornar
const PERSONA_FIELDS = [
  'nombre_legal',
  'email',
  'telefono',
  'tipo_persona',
  'sexo',
  'fecha_nacimiento',
  'curp',
  'rfc',
  'nombre_comercial',
  'regimen',
  'uso_cfdi',
  'direccion_fiscal_calle',
  'direccion_fiscal_colonia',
  'direccion_fiscal_codigo_postal',
  'direccion_fiscal_id_pais',
  'direccion_fiscal_num_int',
  'direccion_fiscal_num_ext'
];

// Función para extraer solo los campos necesarios de persona
function extractPersonaFields(persona: any, porcentaje: number) {
  if (!persona) return null;
  
  const result: any = { porcentaje_copropiedad: porcentaje };
  for (const field of PERSONA_FIELDS) {
    result[field] = persona[field] ?? null;
  }
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const idProyectoParam = url.searchParams.get('id_proyecto');

    if (!idProyectoParam) {
      return new Response(JSON.stringify({ error: 'id_proyecto is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const idProyecto = parseInt(idProyectoParam, 10);
    if (isNaN(idProyecto)) {
      return new Response(JSON.stringify({ error: 'id_proyecto must be a valid integer' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[getPropiedadesCompradores] Fetching data for proyecto: ${idProyecto}`);

    // Step 1: Get edificios for this project
    const { data: edificios, error: edificiosError } = await supabase
      .from('edificios')
      .select('id')
      .eq('id_proyecto', idProyecto)
      .eq('activo', true);

    if (edificiosError) {
      console.error('[getPropiedadesCompradores] Error fetching edificios:', edificiosError);
      throw edificiosError;
    }

    if (!edificios || edificios.length === 0) {
      console.log('[getPropiedadesCompradores] No edificios found for proyecto:', idProyecto);
      return new Response(JSON.stringify({ data: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const edificioIds = edificios.map(e => e.id);

    // Step 2: Get edificios_modelos for these edificios
    const { data: edificiosModelos, error: emError } = await supabase
      .from('edificios_modelos')
      .select('id, id_edificio, id_modelo')
      .in('id_edificio', edificioIds)
      .eq('activo', true);

    if (emError) {
      console.error('[getPropiedadesCompradores] Error fetching edificios_modelos:', emError);
      throw emError;
    }

    if (!edificiosModelos || edificiosModelos.length === 0) {
      console.log('[getPropiedadesCompradores] No edificios_modelos found');
      return new Response(JSON.stringify({ data: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emIds = edificiosModelos.map(em => em.id);
    const modeloIds = [...new Set(edificiosModelos.map(em => em.id_modelo).filter(id => id != null))];

    // Step 3: Get modelos
    const { data: modelos, error: modelosError } = await supabase
      .from('modelos')
      .select('id, nombre')
      .in('id', modeloIds)
      .eq('activo', true);

    if (modelosError) {
      console.error('[getPropiedadesCompradores] Error fetching modelos:', modelosError);
      throw modelosError;
    }

    const modelosMap = new Map((modelos || []).map(m => [m.id, m]));

    // Step 4: Get propiedades for these edificios_modelos (including id_entidad_relacionada_dueno for fallback)
    const { data: propiedades, error: propError } = await supabase
      .from('propiedades')
      .select(`
        id,
        numero_propiedad,
        numero_piso,
        m2_interiores,
        m2_exteriores,
        id_edificio_modelo,
        id_estatus_disponibilidad,
        id_entidad_relacionada_dueno
      `)
      .in('id_edificio_modelo', emIds)
      .eq('activo', true);

    if (propError) {
      console.error('[getPropiedadesCompradores] Error fetching propiedades:', propError);
      throw propError;
    }

    if (!propiedades || propiedades.length === 0) {
      console.log('[getPropiedadesCompradores] No propiedades found');
      return new Response(JSON.stringify({ data: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const propiedadIds = propiedades.map(p => p.id);
    const estatusIds = [...new Set(propiedades.map(p => p.id_estatus_disponibilidad).filter(id => id != null))];
    const entidadDuenoIds = [...new Set(propiedades.map(p => p.id_entidad_relacionada_dueno).filter(id => id != null))];

    // Step 5: Get estatus_disponibilidad
    const { data: estatuses, error: estatusError } = await supabase
      .from('estatus_disponibilidad')
      .select('id, nombre')
      .in('id', estatusIds);

    if (estatusError) {
      console.error('[getPropiedadesCompradores] Error fetching estatus:', estatusError);
    }

    const estatusMap = new Map((estatuses || []).map(e => [e.id, e.nombre]));

    // Step 6: Get entidades_relacionadas for owner fallback
    let entidadesMap = new Map<number, any>();
    if (entidadDuenoIds.length > 0) {
      const { data: entidades, error: entidadesError } = await supabase
        .from('entidades_relacionadas')
        .select('id, id_persona')
        .in('id', entidadDuenoIds)
        .eq('activo', true);

      if (entidadesError) {
        console.error('[getPropiedadesCompradores] Error fetching entidades:', entidadesError);
      } else {
        entidadesMap = new Map((entidades || []).map(e => [e.id, e]));
      }
    }

    // Step 7: Get ofertas for these properties (where id_producto is null)
    const { data: ofertas, error: ofertasError } = await supabase
      .from('ofertas')
      .select('id, id_propiedad')
      .in('id_propiedad', propiedadIds)
      .is('id_producto', null)
      .eq('activo', true);

    if (ofertasError) {
      console.error('[getPropiedadesCompradores] Error fetching ofertas:', ofertasError);
      throw ofertasError;
    }

    const ofertaIds = (ofertas || []).map(o => o.id);

    // Step 8: Get cuentas_cobranza for these ofertas
    let cuentas: any[] = [];
    if (ofertaIds.length > 0) {
      const { data: cuentasData, error: cuentasError } = await supabase
        .from('cuentas_cobranza')
        .select('id, id_oferta')
        .in('id_oferta', ofertaIds)
        .eq('activo', true);

      if (cuentasError) {
        console.error('[getPropiedadesCompradores] Error fetching cuentas:', cuentasError);
        throw cuentasError;
      }
      cuentas = cuentasData || [];
    }

    const cuentaIds = cuentas.map(c => c.id);

    // Step 9: Get compradores for these cuentas
    let compradores: any[] = [];
    if (cuentaIds.length > 0) {
      const { data: compradoresData, error: compradoresError } = await supabase
        .from('compradores')
        .select('id_cuenta_cobranza, id_persona, porcentaje_copropiedad')
        .in('id_cuenta_cobranza', cuentaIds)
        .eq('activo', true);

      if (compradoresError) {
        console.error('[getPropiedadesCompradores] Error fetching compradores:', compradoresError);
        throw compradoresError;
      }
      compradores = compradoresData || [];
    }

    // Step 10: Collect all persona IDs (from compradores + from owner fallback)
    const compradorPersonaIds = compradores.map(c => c.id_persona).filter(id => id != null);
    const ownerPersonaIds = Array.from(entidadesMap.values()).map(e => e.id_persona).filter(id => id != null);
    const allPersonaIds = [...new Set([...compradorPersonaIds, ...ownerPersonaIds])];

    // Step 11: Get personas (only specific fields)
    let personasMap = new Map<number, any>();
    if (allPersonaIds.length > 0) {
      const { data: personasData, error: personasError } = await supabase
        .from('personas')
        .select(PERSONA_FIELDS.join(', ') + ', id')
        .in('id', allPersonaIds);

      if (personasError) {
        console.error('[getPropiedadesCompradores] Error fetching personas:', personasError);
        throw personasError;
      }
      personasMap = new Map((personasData || []).map(p => [p.id, p]));
    }

    // Build the response structure
    const result = propiedades.map(prop => {
      const em = edificiosModelos.find(e => e.id === prop.id_edificio_modelo);
      const modelo = em ? modelosMap.get(em.id_modelo) : null;

      // Find ofertas for this property
      const propOfertaIds = (ofertas || [])
        .filter(o => o.id_propiedad === prop.id)
        .map(o => o.id);

      // Find cuentas for these ofertas
      const propCuentaIds = cuentas
        .filter(c => propOfertaIds.includes(c.id_oferta))
        .map(c => c.id);

      // Find compradores for these cuentas
      const propCompradores = compradores
        .filter(c => propCuentaIds.includes(c.id_cuenta_cobranza))
        .map(c => {
          const persona = personasMap.get(c.id_persona);
          return extractPersonaFields(persona, c.porcentaje_copropiedad);
        })
        .filter(c => c !== null);

      // FALLBACK: If no compradores, get owner from id_entidad_relacionada_dueno
      let finalCompradores = propCompradores;
      if (propCompradores.length === 0 && prop.id_entidad_relacionada_dueno) {
        const entidad = entidadesMap.get(prop.id_entidad_relacionada_dueno);
        if (entidad && entidad.id_persona) {
          const ownerPersona = personasMap.get(entidad.id_persona);
          if (ownerPersona) {
            finalCompradores = [extractPersonaFields(ownerPersona, 100)];
            console.log(`[getPropiedadesCompradores] Using owner fallback for propiedad ${prop.id}`);
          }
        }
      }

      return {
        id_propiedad: prop.id,
        nivel: prop.numero_piso,
        numero_propiedad: prop.numero_propiedad,
        estatus_propiedad: estatusMap.get(prop.id_estatus_disponibilidad) || null,
        m2_interiores: prop.m2_interiores,
        m2_exteriores: prop.m2_exteriores,
        id_modelo: modelo?.id || null,
        modelo: modelo?.nombre || null,
        compradores: finalCompradores
      };
    });

    console.log(`[getPropiedadesCompradores] Found ${result.length} propiedades for proyecto ${idProyecto}`);

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[getPropiedadesCompradores] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
