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

// `usuarios/personas.clave_pais_telefono` es FK a `paises.id` (código ISO, p.ej.
// "MX"), NO la lada numérica. La lada real vive en `paises.clave_pais_telefono`
// (p.ej. "+521"). Casi todo el padrón es "MX", así que mapeamos ISO→lada aquí en
// vez de embeber otro join. Si el valor ya es numérico (dato legacy) se respeta.
const ISO_A_LADA: Record<string, string> = {
  MX: "52", US: "1", CA: "1", ES: "34", AR: "54", CO: "57", PE: "51", CL: "56",
};

function claveALada(raw: string | null | undefined): string {
  if (!raw) return "52";
  const t = raw.trim();
  if (/^\d+$/.test(t)) return t; // ya numérico
  return ISO_A_LADA[t.toUpperCase()] ?? "52";
}

function mapUsuario(u: UsuarioRow): Agent {
  const p = u.personas;
  const rawPhone = p?.telefono ?? u.telefono ?? null;
  const rawClave = claveALada(p?.clave_pais_telefono ?? u.clave_pais_telefono);
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
      let email: string | null = null;

      if (tipo === "seguimiento") {
        // Asesor de pagos/seguimiento: único global durante la fase de pago = Luz Ochoa.
        // (No hay asignación por-cuenta; cuando existan varios, resolver aquí.)
        email = "luz.ochoa@sozu.com";
      } else {
        // comercial: top comisionista por porcentaje_comision de la cuenta
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
