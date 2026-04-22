import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Leer el parámetro fecha_operacion (formato YYYY-MM-DD)
    // Acepta: body JSON o query string ?fecha_operacion=YYYY-MM-DD
    let fechaOperacion: string | null = null;

    // 1) Intentar leer del body
    try {
      const ct = req.headers.get("content-type") || "";
      const cl = req.headers.get("content-length");
      const tieneBody = (cl !== null && cl !== "0") || ct.includes("application/json");
      if (tieneBody) {
        const raw = await req.text();
        if (raw && raw.trim().length > 0) {
          const body = JSON.parse(raw);
          if (body && typeof body.fecha_operacion === "string") {
            fechaOperacion = body.fecha_operacion.trim();
          }
        }
      }
    } catch (_) {
      // body inválido → intentar query string
    }

    // 2) Si no vino en body, intentar query string
    if (!fechaOperacion) {
      const url = new URL(req.url);
      const q = url.searchParams.get("fecha_operacion");
      if (q) fechaOperacion = q.trim();
    }

    // 3) Validar formato YYYY-MM-DD
    if (!fechaOperacion) {
      return new Response(
        JSON.stringify({ error: "Parámetro 'fecha_operacion' requerido en formato YYYY-MM-DD" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaOperacion)) {
      return new Response(
        JSON.stringify({ error: "fecha_operacion debe tener el formato YYYY-MM-DD" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[get-cadenas-cep] method=${req.method} fecha_operacion=${fechaOperacion}`);

    // Traer únicamente la cadena de tabla_datos_cep para una fecha específica.
    const { data: cepRows, error: cepError } = await supabase
      .from("tabla_datos_cep")
      .select("cadena")
      .eq("fecha_operacion", fechaOperacion);

    if (cepError) {
      console.error("Error consultando tabla_datos_cep:", cepError);
      return new Response(
        JSON.stringify({ error: cepError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows: Array<{ cadena: string | null }> = (cepRows ?? []).map((r: any) => ({
      cadena: typeof r.cadena === "string" ? r.cadena : null,
    }));

    return new Response(
      JSON.stringify({
        fecha_operacion: fechaOperacion,
        total: rows.length,
        data: rows,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error inesperado:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});