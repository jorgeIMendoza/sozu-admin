import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    console.log('manage-api-key-secret function called');
    
    // Get request body
    const { action, secretName, secretValue } = await req.json();
    
    console.log(`Action: ${action}, Secret Name: ${secretName}`);

    // Validate inputs
    if (!action || !secretName) {
      throw new Error('Missing required parameters: action and secretName are required');
    }

    if (action === 'set' && !secretValue) {
      throw new Error('Missing secretValue for set action');
    }

    // Get Supabase service role key from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (action === 'set') {
      // Note: Supabase doesn't have a direct API to set secrets programmatically
      // Secrets need to be set via the Supabase CLI or Dashboard
      // For now, we'll store this information in a secure table instead
      // In a production environment, you would use Vault or integrate with Supabase CLI
      
      console.log(`Setting secret ${secretName} (value length: ${secretValue.length})`);
      
      // Store in a secure table (alternative approach)
      // You could also integrate with HashiCorp Vault or AWS Secrets Manager
      const { error: dbError } = await supabaseAdmin
        .from('api_keys_secrets')
        .upsert({
          key_name: secretName,
          key_value: secretValue, // In production, encrypt this
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key_name'
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(`Failed to store secret: ${dbError.message}`);
      }

      console.log(`Secret ${secretName} stored successfully`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Secret stored successfully',
          secretName 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (action === 'get') {
      // Retrieve secret from secure table
      const { data, error: dbError } = await supabaseAdmin
        .from('api_keys_secrets')
        .select('key_value')
        .eq('key_name', secretName)
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(`Failed to retrieve secret: ${dbError.message}`);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          secretValue: data?.key_value 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    throw new Error(`Invalid action: ${action}`);

  } catch (error: any) {
    console.error('Error in manage-api-key-secret function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});