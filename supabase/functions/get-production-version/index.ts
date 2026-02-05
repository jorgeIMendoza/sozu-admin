 import { corsHeaders } from '../_shared/cors.ts';
 
 const PRODUCTION_URL = 'https://sozu-admin.lovable.app';
 
 Deno.serve(async (req) => {
   // Handle CORS preflight
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const response = await fetch(`${PRODUCTION_URL}/version.json?t=${Date.now()}`, {
       headers: {
         'Cache-Control': 'no-cache',
         'User-Agent': 'SOZU-Admin-Server/1.0',
       },
     });
 
     if (!response.ok) {
       return new Response(
         JSON.stringify({ error: 'Failed to fetch production version', status: response.status }),
         { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const data = await response.json();
     
     return new Response(JSON.stringify(data), {
       status: 200,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   } catch (error) {
     console.error('Error fetching production version:', error);
     return new Response(
       JSON.stringify({ error: 'Internal server error', details: error.message }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });