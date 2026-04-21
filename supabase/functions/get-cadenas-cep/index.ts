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

    // Leer el parámetro numero_dias_atras (default 1 = ayer)
    // Acepta: body JSON (cualquier método incluido GET con body), o query string ?numero_dias_atras=N
    let numeroDiasAtras = 1;
    let parsed: number | null = null;

    // 1) Intentar leer del body (independiente del método HTTP)
    try {
      const ct = req.headers.get("content-type") || "";
      const cl = req.headers.get("content-length");
      const tieneBody = (cl !== null && cl !== "0") || ct.includes("application/json");
      if (tieneBody) {
        const raw = await req.text();
        if (raw && raw.trim().length > 0) {
          const body = JSON.parse(raw);
          if (body && typeof body.numero_dias_atras !== "undefined") {
            parsed = Number(body.numero_dias_atras);
          }
        }
      }
    } catch (_) {
      // body inválido → seguir con query string / default
    }

    // 2) Si no vino en body, intentar query string
    if (parsed === null) {
      const url = new URL(req.url);
      const q = url.searchParams.get("numero_dias_atras");
      if (q !== null) parsed = Number(q);
    }

    // 3) Validar
    if (parsed !== null) {
      if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        return new Response(
          JSON.stringify({ error: "numero_dias_atras debe ser un entero >= 0" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      numeroDiasAtras = parsed;
    }

    console.log(`[get-cadenas-cep] method=${req.method} numero_dias_atras=${numeroDiasAtras}`);

    // Calcular fecha objetivo en formato YYYY-MM-DD
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - numeroDiasAtras);
    const fechaObjetivo = fecha.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("tabla_datos_cep")
      .select("cadena")
      .eq("fecha_operacion", fechaObjetivo);

    if (error) {
      console.error("Error consultando tabla_datos_cep:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        numero_dias_atras: numeroDiasAtras,
        fecha_operacion: fechaObjetivo,
        total: data?.length ?? 0,
        data,
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