/**
 * Estado del apartado para la pantalla pública de pago.
 *
 * Fuente preferida: RPC `get_apartado_pagos` (detalle de movimientos STP, aplicados y
 * rechazados, con el faltante). Si todavía no existe en el ambiente, se cae a
 * `get_apartado_status`, que solo responde pagado sí/no — la pantalla se degrada al
 * semáforo binario en vez de romperse.
 *
 * Ambas RPC exigen `reservaciones.token`: sin él responden vacío (fallo cerrado).
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Estado de un depósito.
 *
 * `en_proceso` es real y no cosmético: `insertar_pago_stp` guarda la fila con
 * `es_pago_aplicado` en NULL y es el motor de aplicación quien la marca segundos
 * después. Pintar ese hueco como "rechazado" asustaría al cliente sin motivo.
 */
export type EstadoMovimiento = "aplicado" | "en_proceso" | "rechazado";

/** Un depósito visto por STP en la CLABE del apartado. */
export type MovimientoApartado = {
  claveRastreo: string | null;
  monto: number;
  estado: EstadoMovimiento;
  /** Solo cuando `estado === "rechazado"`. */
  razonRechazo: string | null;
  /** Primer nombre del ordenante (la RPC no devuelve el nombre completo). */
  ordenante: string | null;
  fecha: string | null;
  fechaHora: string | null;
};

export type EstadoApartado = {
  pagado: boolean;
  estatusId: number | null;
  idCuentaCobranza: number | null;
  clabe: string | null;
  /** Monto configurado del apartado (proyectos.monto_apartado). */
  montoObjetivo: number | null;
  totalAplicado: number;
  restante: number | null;
  movimientos: MovimientoApartado[];
  emailEnmascarado: string | null;
  tieneAcceso: boolean;
  /** true → respondió la RPC con detalle; false → fallback binario. */
  conDetalle: boolean;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Consulta el estado del apartado. Devuelve null cuando el token no es válido o la
 * consulta falla: quien llama decide si reintenta.
 */
export async function consultarEstadoApartado(
  ofertaId: number,
  token?: string | null,
): Promise<EstadoApartado | null> {
  if (!ofertaId || !token) return null;

  // 1. RPC con detalle.
  try {
    const { data, error } = await (supabase as any).rpc("get_apartado_pagos", {
      p_oferta_id: ofertaId,
      p_token: token,
    });
    if (!error && data && (data as any).ok) {
      const d = data as any;
      return {
        pagado: !!d.pagado,
        estatusId: d.estatus_id ?? null,
        idCuentaCobranza: d.id_cuenta_cobranza ?? null,
        clabe: d.clabe ?? null,
        montoObjetivo: d.monto_objetivo != null ? num(d.monto_objetivo) : null,
        totalAplicado: num(d.total_aplicado),
        restante: d.restante != null ? num(d.restante) : null,
        movimientos: Array.isArray(d.movimientos)
          ? d.movimientos.map((m: any) => ({
              claveRastreo: m.clave_rastreo ?? null,
              monto: num(m.monto),
              // `estado` lo devuelve la v2 de la RPC. Con la v1 solo llega `aplicado`
              // (booleano ya colapsado): ahí no se puede distinguir el hueco.
              estado: (m.estado as EstadoMovimiento) ??
                (m.aplicado === true ? "aplicado" : m.razon_rechazo ? "rechazado" : "en_proceso"),
              razonRechazo: m.razon_rechazo ?? null,
              ordenante: m.ordenante || null,
              fecha: m.fecha ?? null,
              fechaHora: m.fecha_hora ?? null,
            }))
          : [],
        emailEnmascarado: d.email_enmascarado ?? null,
        tieneAcceso: !!d.tiene_acceso,
        conDetalle: true,
      };
    }
    // `ok: false` = token inválido/expirado. No tiene caso probar la otra RPC:
    // comparte el mismo gate y respondería vacío igual.
    if (!error && data && (data as any).ok === false) return null;
  } catch {
    /* RPC ausente en este ambiente → fallback */
  }

  // 2. Fallback: semáforo binario.
  try {
    const { data, error } = await (supabase as any).rpc("get_apartado_status", {
      p_oferta_id: ofertaId,
      p_token: token,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      pagado: !!row.pagado,
      estatusId: row.estatus_id ?? null,
      idCuentaCobranza: row.id_cuenta_cobranza ?? null,
      clabe: row.clabe_stp ?? null,
      montoObjetivo: null,
      totalAplicado: 0,
      restante: null,
      movimientos: [],
      emailEnmascarado: row.email_enmascarado ?? null,
      tieneAcceso: !!row.tiene_acceso,
      conDetalle: false,
    };
  } catch {
    return null;
  }
}

/** Links de distribución de la app de clientes (`app_cliente_config`). */
export type AppClienteLinks = {
  android: string | null;
  ios: string | null;
  version: string | null;
};

/**
 * Lee los links de tienda. Si la tabla no es legible sin sesión (policy pendiente) o la
 * llave viene vacía, devuelve null en ese campo y la pantalla no pinta ese botón.
 */
export async function cargarLinksApp(): Promise<AppClienteLinks> {
  const vacio: AppClienteLinks = { android: null, ios: null, version: null };
  try {
    const { data, error } = await (supabase as any)
      .from("app_cliente_config")
      .select("key, value")
      .in("key", ["android_store_url", "ios_store_url", "latest_version"]);
    if (error || !Array.isArray(data)) return vacio;
    const map = new Map<string, string>(
      data.map((r: any) => [r.key, (r.value ?? "").trim()]),
    );
    const limpio = (k: string) => map.get(k) || null;
    return {
      android: limpio("android_store_url"),
      ios: limpio("ios_store_url"),
      version: limpio("latest_version"),
    };
  } catch {
    return vacio;
  }
}
