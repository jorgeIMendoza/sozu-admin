import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Domain type ──

export interface Agent {
  id: string;           // email
  fullName: string;
  firstName: string;
  title: string;
  photoUrl: string;
  email: string;
  phone: string;        // display format e.g. "+52 33 1234 5678"
  whatsapp: string;     // digits only e.g. "523312345678"
  isAllied: boolean;
  responseTimeAvg?: string;
}

// ── DB row shapes ──

interface ComisionistaRow {
  email_usuario: string;
}

interface UsuarioRow {
  nombre: string;
  email: string;
  clave_pais_telefono: string | null;
  telefono: string | null;
  rol_id: number;
  roles: { nombre: string } | null;
  personas: {
    nombre_legal: string | null;
    telefono: string | null;
    clave_pais_telefono: string | null;
  } | null;
}

// ── Row → Agent mapper ──

function mapUsuario(u: UsuarioRow): Agent {
  const p = u.personas;
  const rawPhone = p?.telefono ?? u.telefono ?? null;
  const rawClave = (p?.clave_pais_telefono ?? u.clave_pais_telefono ?? "52").replace(/\D/g, "");
  const digitsOnly = rawPhone ? rawPhone.replace(/\D/g, "") : "";
  const whatsapp = digitsOnly ? `${rawClave}${digitsOnly}` : "";
  const phoneDisplay = digitsOnly ? `+${rawClave} ${rawPhone}` : "";
  const fullName = p?.nombre_legal ?? u.nombre;

  return {
    id: u.email,
    fullName,
    firstName: fullName.split(" ")[0],
    title: u.roles?.nombre ?? "Asesor SOZU",
    photoUrl: "",
    email: u.email,
    phone: phoneDisplay,
    whatsapp,
    isAllied: u.rol_id === 3, // Agente Inmobiliario = aliado externo
  };
}

// ── Hook ──

export function useAgentForCuenta(
  cuentaId: string | undefined,
  tipo: "comercial" | "seguimiento" = "comercial",
): { data: Agent | null; isLoading: boolean } {
  return useQuery({
    queryKey: ["agent-for-cuenta", cuentaId, tipo],
    queryFn: async (): Promise<Agent | null> => {
      // Step 1: explicit assignment from asesores_cuenta
      const { data: asig, error: e1 } = await supabase
        .from("asesores_cuenta")
        .select("email_asesor")
        .eq("id_cuenta_cobranza", Number(cuentaId))
        .eq("tipo", tipo)
        .eq("activo", true)
        .maybeSingle();
      // Ignore table-not-found while DDL hasn't been applied yet
      if (e1 && !e1.message?.includes("does not exist")) throw e1;

      let email: string | null = (asig as { email_asesor: string } | null)?.email_asesor ?? null;

      // Fallback for comercial: top comisionista by porcentaje_comision
      if (!email && tipo === "comercial") {
        const { data: com, error: e2 } = await supabase
          .from("comisionistas")
          .select("email_usuario")
          .eq("id_cuenta_cobranza", Number(cuentaId))
          .eq("activo", true)
          .order("porcentaje_comision", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (e2) throw e2;
        email = (com as ComisionistaRow | null)?.email_usuario ?? null;
      }

      if (!email) return null;

      // Step 2: fetch user + persona via FK usuarios.id_persona → personas.id
      const { data: u, error: e3 } = await supabase
        .from("usuarios")
        .select(
          "nombre, email, clave_pais_telefono, telefono, rol_id, roles(nombre), personas(nombre_legal, telefono, clave_pais_telefono)",
        )
        .eq("email", email)
        .eq("activo", true)
        .maybeSingle();
      if (e3) throw e3;
      if (!u) return null;

      return mapUsuario(u as unknown as UsuarioRow);
    },
    enabled: !!cuentaId,
    staleTime: 300_000,
  });
}

// ── Contact link helpers ──

export function buildAgentWhatsAppLink(agent: Agent, prefilledMessage?: string): string {
  const msg = prefilledMessage ?? `Hola ${agent.firstName}, tengo una consulta sobre mi propiedad SOZU.`;
  return `https://wa.me/${agent.whatsapp}?text=${encodeURIComponent(msg)}`;
}

export function buildAgentPhoneLink(agent: Agent): string {
  return `tel:${agent.phone.replace(/\s/g, "")}`;
}

export function buildAgentEmailLink(agent: Agent, subject?: string): string {
  const subj = subject ?? "Consulta sobre propiedad SOZU";
  return `mailto:${agent.email}?subject=${encodeURIComponent(subj)}`;
}
