import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  email: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Create a client with the user's token to verify their identity
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the requesting user
    const { data: { user: requestingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !requestingUser) {
      console.error('Error getting requesting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if requesting user is a Super Administrator
    const { data: requestingUserData, error: requestingUserError } = await supabaseAdmin
      .from('usuarios')
      .select('rol_id, roles(nombre)')
      .eq('auth_user_id', requestingUser.id)
      .single();

    if (requestingUserError || !requestingUserData) {
      console.error('Error fetching requesting user data:', requestingUserError);
      return new Response(
        JSON.stringify({ error: 'Error fetching user data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rolNombre = (requestingUserData.roles as any)?.nombre;
    if (rolNombre !== 'Super Administrador') {
      return new Response(
        JSON.stringify({ error: 'Solo los Super Administradores pueden resetear contraseñas' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { email } = await req.json() as ResetPasswordRequest;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent resetting own password
    if (requestingUser.email === email) {
      return new Response(
        JSON.stringify({ error: 'No puedes resetear tu propia contraseña desde esta función' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Resetting password for user: ${email}`);

    // Get the target user's auth_user_id
    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('usuarios')
      .select('auth_user_id')
      .eq('email', email)
      .single();

    if (targetUserError || !targetUser?.auth_user_id) {
      console.error('Error finding target user:', targetUserError);
      return new Response(
        JSON.stringify({ error: 'Usuario no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reset password in auth.users
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.auth_user_id,
      { password: 'Temporal123!' }
    );

    if (updateAuthError) {
      console.error('Error updating auth password:', updateAuthError);
      return new Response(
        JSON.stringify({ error: `Error al resetear contraseña: ${updateAuthError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update usuarios table to mark password as temporary
    const { error: updateUsuarioError } = await supabaseAdmin
      .from('usuarios')
      .update({ 
        debe_cambiar_password: true,
        fecha_actualizacion: new Date().toISOString()
      })
      .eq('email', email);

    if (updateUsuarioError) {
      console.error('Error updating usuarios table:', updateUsuarioError);
      // Password was already reset, so we continue
    }

    console.log(`Password reset successfully for: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Contraseña reseteada exitosamente. Nueva contraseña temporal: Temporal123!` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: `Error inesperado: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
