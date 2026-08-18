import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalPersonalImpersonation } from "@/contexts/PortalPersonalImpersonationContext";

/**
 * Perfil REAL de la persona que está viendo el Portal del Personal.
 *
 * Se arma cruzando lo que ya existe en la base, sin capturar nada nuevo:
 *
 *   usuarios (cuenta de acceso)      ← por correo
 *     → roles                        ← rol de acceso al sistema
 *     → usuarios.id_persona
 *        → personas                  ← información personal y fiscal
 *        → documentos                ← su expediente (vía ExpedienteDocsPanel)
 *        → cuentas_bancarias         ← cuenta de depósito
 *   personal_organizacional          ← por el mismo correo (email_usuario)
 *     → roles_organizacionales       ← su PUESTO en la organización
 *     → personal_proyectos           ← proyectos asignados y su % de dedicación
 *
 * Waterfall explícito (patrón #1 de CLAUDE.md): los embeds anidados de PostgREST
 * fallan en silencio sobre estas tablas.
 *
 * Ojo con dos huecos legítimos que la pantalla debe saber contar:
 *   - `usuarios.id_persona` puede ser null (cuenta sin persona ligada): no hay
 *     RFC, CURP ni expediente que mostrar.
 *   - puede no haber fila en `personal_organizacional` (no está en el Directorio):
 *     no hay puesto ni proyectos asignados.
 */

export interface ProyectoAsignado {
  id: number;
  nombre: string;
  asignacionPct: number;
  rol: string | null;
}

export interface CuentaDeposito {
  clabe: string | null;
  titular: string | null;
  banco: string | null;
  /** `estatus_verificacion`: 2 = Validado. */
  validada: boolean;
}

export interface PerfilPersonal {
  /* Cuenta de acceso */
  email: string;
  nombreCuenta: string | null;
  emailConfirmado: boolean;
  rolAcceso: string | null;
  telefono: string | null;
  fotoUrl: string | null;
  ultimoCambioPassword: string | null;
  fechaAltaCuenta: string | null;

  /* Directorio de personal */
  personalId: number | null;
  puesto: string | null;
  tipoPersonal: "empleado_sozu" | "colaborador_investimento" | null;
  fechaIngreso: string | null;

  /* Persona */
  personaId: number | null;
  nombreLegal: string | null;
  rfc: string | null;
  curp: string | null;
  fechaNacimiento: string | null;
  regimen: string | null;
  direccion: string | null;

  cuentaDeposito: CuentaDeposito | null;
  proyectos: ProyectoAsignado[];
}

const armarDireccion = (p: any): string | null => {
  const partes = [
    [p.direccion_calle, p.direccion_num_ext].filter(Boolean).join(" "),
    p.direccion_num_int ? `Int. ${p.direccion_num_int}` : null,
    p.direccion_colonia,
    p.direccion_codigo_postal ? `C.P. ${p.direccion_codigo_postal}` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(", ") : null;
};

export function usePerfilPersonal() {
  const { profile } = useAuth();
  const { impersonatedUser, isImpersonating } = usePortalPersonalImpersonation();
  const email = ((isImpersonating ? impersonatedUser?.email : profile?.email) ?? "").trim();

  const query = useQuery<PerfilPersonal | null>({
    queryKey: ["portal-personal-perfil", email.toLowerCase()],
    enabled: email.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      // 1. Cuenta de acceso. `usuarios` tiene el correo como llave (no hay `id`).
      const { data: usuarios } = await (supabase as any)
        .from("usuarios")
        .select(
          "email, nombre, telefono, clave_pais_telefono, foto_perfil_url, rol_id, id_persona, email_confirmado, ultimo_cambio_password, fecha_creacion, roles(nombre)",
        )
        .ilike("email", email)
        .limit(1);
      const u = ((usuarios as any[]) ?? [])[0];
      if (!u) return null;

      // 2. Directorio de personal (puesto y antigüedad).
      const { data: personal } = await (supabase as any)
        .from("personal_organizacional")
        .select("id, tipo_personal, fecha_ingreso, id_rol")
        .ilike("email_usuario", email)
        .eq("activo", true)
        .limit(1);
      const po = ((personal as any[]) ?? [])[0] ?? null;

      let puesto: string | null = null;
      if (po?.id_rol != null) {
        const { data: rolOrg } = await (supabase as any)
          .from("roles_organizacionales")
          .select("nombre")
          .eq("id", po.id_rol)
          .maybeSingle();
        puesto = (rolOrg?.nombre as string) ?? null;
      }

      // 3. Persona (información personal y fiscal) y cuenta de depósito.
      let persona: any = null;
      let cuentaDeposito: CuentaDeposito | null = null;
      if (u.id_persona != null) {
        const [personaRes, cuentaRes] = await Promise.all([
          (supabase as any)
            .from("personas")
            .select(
              "id, nombre_legal, rfc, curp, fecha_nacimiento, regimen, direccion_calle, direccion_num_ext, direccion_num_int, direccion_colonia, direccion_codigo_postal",
            )
            .eq("id", u.id_persona)
            .maybeSingle(),
          (supabase as any)
            .from("cuentas_bancarias")
            .select("cuenta_clabe, titular, id_banco, id_estatus_verificacion, bancos(nombre)")
            .eq("id_persona", u.id_persona)
            .eq("activo", true)
            .order("id", { ascending: false })
            .limit(1),
        ]);
        persona = personaRes?.data ?? null;
        const cb = ((cuentaRes?.data as any[]) ?? [])[0];
        if (cb) {
          cuentaDeposito = {
            clabe: (cb.cuenta_clabe as string) ?? null,
            titular: (cb.titular as string) ?? null,
            banco: (cb.bancos?.nombre as string) ?? null,
            validada: cb.id_estatus_verificacion === 2,
          };
        }
      }

      // 4. Proyectos asignados (con el rol que asume en cada uno).
      let proyectos: ProyectoAsignado[] = [];
      if (po?.id != null) {
        const { data: asignaciones } = await (supabase as any)
          .from("personal_proyectos")
          .select("id_proyecto, asignacion_pct, id_rol")
          .eq("id_personal", po.id)
          .eq("activo", true);
        const filas = ((asignaciones as any[]) ?? []);
        if (filas.length) {
          const idsProyecto = Array.from(new Set(filas.map((a) => a.id_proyecto as number)));
          const idsRol = Array.from(
            new Set(filas.map((a) => a.id_rol as number | null).filter((v): v is number => v != null)),
          );
          const [proyRes, rolRes] = await Promise.all([
            (supabase as any).from("proyectos").select("id, nombre").in("id", idsProyecto),
            idsRol.length
              ? (supabase as any).from("roles_organizacionales").select("id, nombre").in("id", idsRol)
              : Promise.resolve({ data: [] }),
          ]);
          const nombreProy = new Map(((proyRes?.data as any[]) ?? []).map((p) => [p.id, p.nombre]));
          const nombreRol = new Map(((rolRes?.data as any[]) ?? []).map((r) => [r.id, r.nombre]));
          proyectos = filas.map((a) => ({
            id: a.id_proyecto as number,
            nombre: (nombreProy.get(a.id_proyecto) as string) ?? `Proyecto ${a.id_proyecto}`,
            asignacionPct: Number(a.asignacion_pct ?? 0),
            rol: a.id_rol != null ? ((nombreRol.get(a.id_rol) as string) ?? null) : puesto,
          }));
        }
      }

      const lada = (u.clave_pais_telefono as string)?.trim();
      return {
        email: u.email as string,
        nombreCuenta: (u.nombre as string) ?? null,
        emailConfirmado: u.email_confirmado === true,
        rolAcceso: (u.roles?.nombre as string) ?? null,
        telefono: u.telefono ? `${lada ? `+${lada} ` : ""}${u.telefono}` : null,
        fotoUrl: (u.foto_perfil_url as string) ?? null,
        ultimoCambioPassword: (u.ultimo_cambio_password as string) ?? null,
        fechaAltaCuenta: (u.fecha_creacion as string) ?? null,

        personalId: (po?.id as number) ?? null,
        puesto,
        tipoPersonal: po
          ? po.tipo_personal === "colaborador_investimento"
            ? "colaborador_investimento"
            : "empleado_sozu"
          : null,
        fechaIngreso: (po?.fecha_ingreso as string) ?? null,

        personaId: (u.id_persona as number) ?? null,
        nombreLegal: (persona?.nombre_legal as string) ?? null,
        rfc: (persona?.rfc as string) ?? null,
        curp: (persona?.curp as string) ?? null,
        fechaNacimiento: (persona?.fecha_nacimiento as string) ?? null,
        regimen: (persona?.regimen as string) ?? null,
        direccion: persona ? armarDireccion(persona) : null,

        cuentaDeposito,
        proyectos,
      };
    },
  });

  return {
    perfil: query.data ?? null,
    isLoading: email.length > 0 && query.isLoading,
    /** El correo no corresponde a ninguna cuenta del sistema. */
    sinCuenta: email.length > 0 && !query.isLoading && !query.data,
    refetch: query.refetch,
  };
}
