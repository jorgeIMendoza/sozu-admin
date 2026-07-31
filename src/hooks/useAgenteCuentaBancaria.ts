import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cuenta bancaria que el agente/comisionista externo dio de alta para recibir su
 * comisión y honorarios. Se resuelve por el email del comisionista:
 *   email → personas.id → cuentas_bancarias (activa) → bancos.nombre
 *
 * Si el agente tiene varias cuentas activas, se prioriza la verificada
 * (id_estatus_verificacion = 2) y luego la más reciente.
 */
export interface AgenteCuentaBancaria {
  banco: string | null;
  numero_cuenta: string | null;
  titular: string | null;
  clabe: string | null;
  /** URL de la imagen de la carátula bancaria. */
  url_evidencia: string | null;
  verificada: boolean;
}

export function useAgenteCuentaBancaria(email: string | null | undefined) {
  return useQuery({
    queryKey: ["agente_cuenta_bancaria", email],
    enabled: !!email,
    staleTime: 60_000,
    queryFn: async (): Promise<AgenteCuentaBancaria | null> => {
      // 1) Persona por email.
      const { data: personas } = await (supabase as any)
        .from("personas")
        .select("id")
        .eq("email", email)
        .eq("activo", true)
        .order("id")
        .limit(1);
      const idPersona = ((personas || [])[0]?.id as number | undefined) ?? undefined;
      if (!idPersona) return null;

      // 2) Cuentas bancarias activas de la persona.
      const { data: cuentas } = await (supabase as any)
        .from("cuentas_bancarias")
        .select(
          "id, id_banco, numero_cuenta, titular, cuenta_clabe, url_evidencia, id_estatus_verificacion, fecha_creacion",
        )
        .eq("id_persona", idPersona)
        .eq("activo", true);
      const rows = (cuentas || []) as Array<any>;
      if (!rows.length) return null;

      // Preferir verificada (estatus=2), luego la más reciente.
      rows.sort((a, b) => {
        const av = a.id_estatus_verificacion === 2 ? 1 : 0;
        const bv = b.id_estatus_verificacion === 2 ? 1 : 0;
        if (av !== bv) return bv - av;
        return String(b.fecha_creacion).localeCompare(String(a.fecha_creacion));
      });
      const cuenta = rows[0];

      // 3) Nombre del banco.
      let banco: string | null = null;
      if (cuenta.id_banco) {
        const { data: b } = await supabase
          .from("bancos")
          .select("nombre")
          .eq("id", cuenta.id_banco)
          .maybeSingle();
        banco = b?.nombre ?? null;
      }

      return {
        banco,
        numero_cuenta: cuenta.numero_cuenta ?? null,
        titular: cuenta.titular ?? null,
        clabe: cuenta.cuenta_clabe ?? null,
        url_evidencia: cuenta.url_evidencia ?? null,
        verificada: cuenta.id_estatus_verificacion === 2,
      };
    },
  });
}
