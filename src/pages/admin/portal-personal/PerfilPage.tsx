import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { usePortal } from "@/lib/portal-personal/portal-store";
import { REGLAS } from "@/lib/portal-personal/mock";
import { usePerfilPersonal } from "@/hooks/usePortalPersonalPerfil";
import { useExpedienteDocs } from "@/hooks/useExpedienteDocs";
import { ExpedienteDocsPanel, type ExpDocDef } from "@/components/admin/expediente/ExpedienteDocsPanel";
import { LinkReferido } from "@/components/admin/portal-personal/comunes/LinkReferido";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AvatarColaborador } from "@/components/admin/portal-personal/comunes/Avatar";
import { normalizeAvatarUrl } from "@/lib/avatarUrl";
import { cn } from "@/lib/utils";

/**
 * Mi perfil — conectado a la información REAL de la persona.
 *
 * Lo que se lee de la base (ver `usePerfilPersonal`): cuenta de acceso y rol,
 * puesto y antigüedad del Directorio de Personal, datos personales y fiscales de
 * `personas`, expediente de `documentos` (con el mismo panel que usa el Portal
 * Agente) y cuenta de depósito de `cuentas_bancarias`.
 *
 * Sigue siendo del programa (no del expediente) y está marcado como tal: las
 * Reglas del Programa, la declaración de conflicto de interés, la bitácora y el
 * link de referido.
 */

/**
 * Expediente del personal. La identidad es UN documento: INE (frente+reverso) o
 * pasaporte — el panel resuelve el selector y la captura.
 */
const DOCS_PERSONAL: ExpDocDef[] = [
  { key: "identidad", kind: "identity" },
  {
    key: "csf",
    nombre: "Constancia de Situación Fiscal",
    emisor: "SAT",
    hint: "PDF del SAT, no mayor a 3 meses",
    tipos: [6],
    kind: "pdf",
    csf: true,
  },
  { key: "curp", nombre: "CURP", emisor: "RENAPO", hint: "PDF descargado de gob.mx", tipos: [5], kind: "pdf" },
  {
    key: "domicilio",
    nombre: "Comprobante de domicilio",
    emisor: "Servicio",
    hint: "Recibo no mayor a 3 meses",
    tipos: [8],
    kind: "pdf",
  },
];

/** Tipos de `tipos_documento` que componen el expediente (incluye INE completo). */
const TIPOS_EXPEDIENTE = [2, 3, 4, 63, 6, 5, 8];
/** Grupos de tipos que cuentan como "un documento" para el avance. */
const GRUPOS_AVANCE = [[2, 3, 4, 63], [6], [5], [8]];

type ClaveSeccion =
  | "cuenta"
  | "identidad"
  | "documentos"
  | "deposito"
  | "proyectos"
  | "reglas"
  | "conflicto"
  | "bitacora"
  | "seguridad";

const fecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }) : "—";

export default function PerfilPage() {
  const modo = usePortal((s) => s.modo_presentacion);
  const logs = usePortal((s) => s.logs);
  const usuarioMock = usePortal((s) => s.usuario);
  const firmar = usePortal((s) => s.firmarConflictoInteres);
  const registrarLog = usePortal((s) => s.registrarLog);

  const { perfil, isLoading, sinCuenta } = usePerfilPersonal();

  const [abierta, setAbierta] = useState<ClaveSeccion | null>(null);
  const [modalCI, setModalCI] = useState(false);
  const [clabeVisible, setClabeVisible] = useState(false);
  const [aceptoCI, setAceptoCI] = useState(false);

  const oculto = (v: string | null | undefined) => (modo ? "••••••" : v || "—");

  // Avance del expediente: documentos validados sobre los que se piden.
  const { tipoEstado, isLoading: cargandoDocs } = useExpedienteDocs({
    personaId: perfil?.personaId ?? null,
    tipos: TIPOS_EXPEDIENTE,
  });

  const avance = useMemo(() => {
    const estados = GRUPOS_AVANCE.map((grupo) =>
      grupo.some((t) => tipoEstado(t) === "validado")
        ? "validado"
        : grupo.some((t) => tipoEstado(t) === "revision" || tipoEstado(t) === "rechazado")
          ? "en_proceso"
          : "pendiente",
    );
    const validadas = estados.filter((e) => e === "validado").length;
    return {
      validadas,
      enProceso: estados.filter((e) => e === "en_proceso").length,
      pendientes: estados.filter((e) => e === "pendiente").length,
      total: estados.length,
      pct: Math.round((validadas / estados.length) * 100),
    };
  }, [tipoEstado]);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center gap-2 p-10 text-sm text-gris">
        <Loader2 className="size-4 animate-spin" />
        Cargando tu perfil...
      </div>
    );
  }

  if (sinCuenta || !perfil) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card-sozu flex flex-col items-center gap-3 p-10 text-center">
          <ShieldAlert className="size-6 text-gris" />
          <p className="text-lg font-bold text-negro">No encontramos tu perfil</p>
          <p className="text-sm text-gris">
            Tu correo no corresponde a ninguna cuenta del sistema.
          </p>
        </div>
      </div>
    );
  }

  const nombre = perfil.nombreLegal || perfil.nombreCuenta || perfil.email;
  const sinPersona = perfil.personaId == null;
  const sinDirectorio = perfil.personalId == null;
  const pendientesExpediente = avance.total - avance.validadas;

  const clabe = perfil.cuentaDeposito?.clabe ?? null;
  const clabeEnmascarada = clabe ? `···· ···· ···· ·· ${clabe.slice(-4)}` : "—";

  const badgeDoc = (validado: boolean, hayAlgo: boolean) =>
    validado
      ? ({ texto: "Completado", tono: "verde" } as const)
      : hayAlgo
        ? ({ texto: "En proceso", tono: "ambar" } as const)
        : ({ texto: "Pendiente", tono: "ambar" } as const);

  const secciones: {
    clave: ClaveSeccion;
    titulo: string;
    descripcion: string;
    badge: { texto: string; tono: "gris" | "verde" | "ambar" };
  }[] = [
    {
      clave: "cuenta",
      titulo: "Datos de tu cuenta",
      descripcion: "Puesto, tipo de colaborador, rol de acceso y antigüedad",
      badge: { texto: "Solo lectura", tono: "gris" },
    },
    {
      clave: "identidad",
      titulo: "Identidad",
      descripcion: "Datos personales, RFC y CURP",
      badge: sinPersona
        ? { texto: "Sin persona ligada", tono: "ambar" }
        : perfil.rfc && perfil.curp
          ? { texto: "Completado", tono: "verde" }
          : { texto: "Incompleto", tono: "ambar" },
    },
    {
      clave: "documentos",
      titulo: "Documentos",
      descripcion: sinPersona
        ? "Requiere una persona ligada a tu cuenta"
        : `${avance.validadas} de ${avance.total} documentos validados`,
      badge: badgeDoc(avance.validadas === avance.total, avance.enProceso > 0),
    },
    {
      clave: "deposito",
      titulo: "Cuenta de depósito",
      descripcion: "Banco, CLABE y titular",
      badge: perfil.cuentaDeposito
        ? perfil.cuentaDeposito.validada
          ? { texto: "Validada", tono: "verde" }
          : { texto: "En revisión", tono: "ambar" }
        : { texto: "Pendiente", tono: "ambar" },
    },
    {
      clave: "proyectos",
      titulo: "Proyectos asignados",
      descripcion: perfil.proyectos.length
        ? perfil.proyectos.map((p) => p.nombre).join(", ")
        : "Sin proyectos asignados en el Directorio",
      badge: { texto: "Solo lectura", tono: "gris" },
    },
    {
      clave: "reglas",
      titulo: "Reglas del Programa",
      descripcion: `Consulta y acepta las reglas vigentes (v${REGLAS.version})`,
      badge:
        usuarioMock.reglas_aceptadas_version === REGLAS.version
          ? { texto: "Completado", tono: "verde" }
          : { texto: "Pendiente", tono: "ambar" },
    },
    {
      clave: "conflicto",
      titulo: "Declaración de conflicto de interés",
      descripcion: usuarioMock.conflicto_interes_firmado_en
        ? `Firmada el ${fecha(usuarioMock.conflicto_interes_firmado_en)}`
        : "Pendiente de firma",
      badge: usuarioMock.conflicto_interes_firmado_en
        ? { texto: "Completado", tono: "verde" }
        : { texto: "Pendiente", tono: "ambar" },
    },
    {
      clave: "bitacora",
      titulo: "Bitácora de actividad",
      descripcion: "Registro histórico. No se edita ni se borra.",
      badge: { texto: "Solo lectura", tono: "gris" },
    },
    {
      clave: "seguridad",
      titulo: "Seguridad",
      descripcion: "Acceso y contraseña",
      badge: perfil.emailConfirmado
        ? { texto: "Correo confirmado", tono: "verde" }
        : { texto: "Correo sin confirmar", tono: "ambar" },
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Identidad + activación */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="card-sozu p-6">
          <div className="flex flex-wrap items-start gap-5">
            <AvatarColaborador
              nombre={nombre}
              foto={normalizeAvatarUrl(perfil.fotoUrl) || null}
              enmascarado={modo}
              className="size-20 text-xl"
            />
            <div className="flex-1">
              <h2 className="text-[26px] font-bold leading-tight text-negro">{oculto(nombre)}</h2>
              <p className="text-sm text-gris">
                {perfil.puesto ?? "Sin puesto en el Directorio"}
                {perfil.rolAcceso ? ` · ${perfil.rolAcceso}` : ""}
              </p>
              <p className="num mt-1 text-sm text-gris">
                {oculto(perfil.email)}
                {perfil.telefono ? ` · ${oculto(perfil.telefono)}` : ""}
              </p>
            </div>
            <BadgeExpediente
              sinPersona={sinPersona}
              pendientes={pendientesExpediente}
              cargando={cargandoDocs}
            />
          </div>

          {sinDirectorio && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-ambar-borde bg-ambar-claro p-4">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-ambar" />
              <p className="text-sm text-negro">
                Tu cuenta no está dada de alta en el Directorio de Personal, así que no podemos
                mostrar tu puesto ni tus proyectos asignados. Pide que te registren en{" "}
                <b>Estructura de comisiones → Roles y sueldos</b> con este correo.
              </p>
            </div>
          )}

          <div className="mt-6">
            {/* Programa de referidos: el código sigue siendo del mock. */}
            <LinkReferido variante="barra" />
          </div>
        </section>

        <section className="card-sozu p-6">
          <p className="eyebrow text-gris">Activación</p>
          <p className="num mt-1 text-[40px] font-bold leading-none text-verde">{avance.pct}%</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-verde" style={{ width: `${avance.pct}%` }} />
          </div>
          <p className="mt-3 text-sm text-gris">
            Se calcula sobre los documentos validados de tu expediente.
          </p>
        </section>
      </div>

      {/* Expediente */}
      <section className="rounded-xl border border-verde/30 bg-verde-claro p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <div>
            <p className="eyebrow text-verde">Tu expediente · el motor de tu activación</p>
            <h3 className="mt-2 text-[24px] font-bold leading-tight text-verde-oscuro">
              Tu información se construye desde tus documentos.
            </h3>
            <p className="mt-2 text-sm text-gris">
              Cada documento que subes alimenta tu información personal y fiscal. Solo validas lo
              que ya dijeron.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button variant="outline" className="bg-background" onClick={() => setAbierta("documentos")}>
                <FileText className="size-4" />
                Gestionar documentos
              </Button>
              <span className="num text-sm text-gris">
                {avance.validadas} de {avance.total} documentos validados
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-background p-4">
            <p className="eyebrow text-gris">Estado de tus documentos</p>
            <ul className="mt-3 space-y-3">
              <FilaEstado n={avance.validadas} texto="validados" tono="verde" />
              <FilaEstado n={avance.enProceso} texto="en proceso" tono="ambar" />
              <FilaEstado n={avance.pendientes} texto="pendientes" tono="gris" />
            </ul>
          </div>
        </div>
      </section>

      {/* Secciones */}
      <section>
        <p className="eyebrow text-gris">Secciones de tu perfil</p>
        <div className="mt-3 space-y-3">
          {secciones.map((s) => (
            <div key={s.clave} className="card-sozu overflow-hidden">
              <button
                type="button"
                onClick={() => setAbierta(abierta === s.clave ? null : s.clave)}
                className="flex w-full items-center gap-4 p-5 text-left"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-negro">{s.titulo}</p>
                    <Badge tono={s.badge.tono}>{s.badge.texto}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-gris">{s.descripcion}</p>
                </div>
                <ChevronRight
                  className={cn(
                    "size-4 shrink-0 text-gris transition-transform",
                    abierta === s.clave && "rotate-90",
                  )}
                />
              </button>

              {abierta === s.clave && (
                <div className="border-t border-border p-5">
                  {s.clave === "cuenta" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Campo label="Puesto" valor={perfil.puesto ?? "—"} />
                      <Campo
                        label="Tipo de colaborador"
                        valor={
                          perfil.tipoPersonal === "colaborador_investimento"
                            ? "Colaborador Investimento"
                            : perfil.tipoPersonal === "empleado_sozu"
                              ? "Empleado SOZU"
                              : "—"
                        }
                      />
                      <Campo label="Rol de acceso al sistema" valor={perfil.rolAcceso ?? "—"} />
                      <Campo label="Fecha de ingreso" valor={fecha(perfil.fechaIngreso)} />
                      <Campo label="Alta de la cuenta" valor={fecha(perfil.fechaAltaCuenta)} />
                    </div>
                  )}

                  {s.clave === "identidad" &&
                    (sinPersona ? (
                      <p className="text-sm text-gris">
                        Tu cuenta todavía no tiene una persona ligada, así que no hay datos
                        personales ni fiscales que mostrar. Se crean al capturar tu expediente.
                      </p>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Campo label="Nombre legal" valor={oculto(perfil.nombreLegal)} />
                        <Campo label="Correo" valor={oculto(perfil.email)} />
                        <Campo label="Teléfono" valor={oculto(perfil.telefono)} />
                        <Campo label="Fecha de nacimiento" valor={modo ? "••••••" : fecha(perfil.fechaNacimiento)} />
                        <Campo label="RFC" valor={oculto(perfil.rfc)} />
                        <Campo label="CURP" valor={oculto(perfil.curp)} />
                        <Campo label="Régimen fiscal" valor={oculto(perfil.regimen)} />
                        <Campo label="Domicilio" valor={oculto(perfil.direccion)} />
                      </div>
                    ))}

                  {s.clave === "documentos" &&
                    (sinPersona ? (
                      <p className="text-sm text-gris">
                        El expediente se guarda contra tu persona y tu cuenta aún no tiene una
                        ligada. En cuanto exista, aquí podrás subir y consultar tus documentos.
                      </p>
                    ) : (
                      <ExpedienteDocsPanel
                        personaId={perfil.personaId}
                        docs={DOCS_PERSONAL}
                        queryTipos={TIPOS_EXPEDIENTE}
                      />
                    ))}

                  {s.clave === "deposito" &&
                    (perfil.cuentaDeposito ? (
                      <div>
                        <p className="text-sm text-gris">
                          Tus ganancias se depositan aquí. El nombre del titular debe coincidir con
                          tu RFC.
                        </p>
                        <div className="mt-4 flex items-center gap-2">
                          <p className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 font-mono text-sm tracking-wider text-negro">
                            {clabeVisible && !modo ? (clabe ?? "—") : clabeEnmascarada}
                          </p>
                          {!modo && clabe && (
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label={clabeVisible ? "Ocultar CLABE" : "Revelar CLABE"}
                              onClick={() => {
                                if (!clabeVisible) {
                                  registrarLog(
                                    "revelacion_clabe",
                                    "El colaborador reveló su CLABE en pantalla",
                                  );
                                }
                                setClabeVisible(!clabeVisible);
                              }}
                            >
                              {clabeVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </Button>
                          )}
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <Campo label="Titular" valor={oculto(perfil.cuentaDeposito.titular)} />
                          <Campo label="Banco" valor={perfil.cuentaDeposito.banco ?? "—"} />
                        </div>
                        {perfil.cuentaDeposito.validada ? (
                          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-verde-claro px-3 py-1.5 text-xs font-semibold text-verde-oscuro">
                            <CheckCircle2 className="size-3.5" />
                            Cuenta validada
                          </p>
                        ) : (
                          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-ambar-claro px-3 py-1.5 text-xs font-semibold text-ambar">
                            <Clock3 className="size-3.5" />
                            En revisión
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gris">
                        Aún no tienes una cuenta de depósito registrada. Se da de alta con tu
                        expediente; sin ella no se puede dispersar ningún pago.
                      </p>
                    ))}

                  {s.clave === "proyectos" &&
                    (perfil.proyectos.length ? (
                      <div className="space-y-3">
                        {perfil.proyectos.map((p) => (
                          <div
                            key={p.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                          >
                            <div>
                              <p className="text-sm font-semibold text-negro">{p.nombre}</p>
                              {p.rol && <p className="text-xs text-gris">Como {p.rol}</p>}
                            </div>
                            <span className="num text-sm font-bold text-verde">
                              {p.asignacionPct}% de dedicación
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gris">
                        No tienes proyectos asignados en el Directorio de Personal.
                      </p>
                    ))}

                  {s.clave === "reglas" && (
                    <div>
                      <p className="text-sm text-gris">
                        Documento versionado. Vigente desde {REGLAS.vigente_desde}.
                      </p>
                      <Link
                        to="/admin/portal-personal/reglas"
                        className="mt-3 inline-block text-sm font-semibold text-verde"
                      >
                        Ver Reglas del Programa v{REGLAS.version}
                      </Link>
                    </div>
                  )}

                  {s.clave === "conflicto" && (
                    <div>
                      <div className="space-y-2 text-sm text-gris">
                        <p>
                          Puedes referir a familiares, amigos y conocidos. Ese es el propósito del
                          programa.
                        </p>
                        <p>
                          Lo que no puedes hacer es participar en una operación sobre la que tengas
                          poder de decisión.
                        </p>
                      </div>
                      {usuarioMock.conflicto_interes_firmado_en ? (
                        <p className="num mt-4 inline-flex items-center gap-2 rounded-full bg-verde-claro px-3 py-1.5 text-xs font-semibold text-verde-oscuro">
                          <CheckCircle2 className="size-3.5" />
                          Firmada el {fecha(usuarioMock.conflicto_interes_firmado_en)}
                        </p>
                      ) : (
                        <Button className="mt-4" onClick={() => setModalCI(true)}>
                          Firmar declaración
                        </Button>
                      )}
                    </div>
                  )}

                  {s.clave === "bitacora" && (
                    <div>
                      {/* SWAP POINT: supabase.logs_auditoria (append-only) */}
                      <p className="text-sm text-gris">
                        Registro histórico. No se edita ni se borra.
                      </p>
                      <ol className="mt-4 space-y-3">
                        {[...logs].reverse().map((l) => (
                          <li key={l.id} className="border-b border-border pb-3 last:border-0">
                            <p className="text-sm font-semibold text-negro">
                              {l.accion.replace(/_/g, " ")}
                            </p>
                            <p className="text-sm text-gris">{l.detalle}</p>
                            <p className="num text-xs text-gris">{l.fecha}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {s.clave === "seguridad" && (
                    <div className="space-y-3">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Campo
                          label="Correo de acceso"
                          valor={`${perfil.email}${perfil.emailConfirmado ? " (confirmado)" : " (sin confirmar)"}`}
                        />
                        <Campo
                          label="Último cambio de contraseña"
                          valor={fecha(perfil.ultimoCambioPassword)}
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => toast.success("Te enviamos un correo para cambiarla")}
                      >
                        Cambiar contraseña
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <Dialog open={modalCI} onOpenChange={setModalCI}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Declaración de conflicto de interés</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gris">
            <p className="num text-xs">Reglas del Programa v{REGLAS.version}</p>
            <p>Puedes referir a familiares, amigos y conocidos. Ese es el propósito del programa.</p>
            <p>
              Lo que no puedes hacer es participar en una operación sobre la que tengas poder de
              decisión. Al firmar declaras que:
            </p>
            <ul className="space-y-2">
              <li>
                · No autorizas ni modificas precios, descuentos o esquemas de pago de las unidades
                que refieres.
              </li>
              <li>· No apruebas el crédito, el financiamiento ni la cobranza de tus referidos.</li>
              <li>· No controlas la asignación ni el bloqueo del inventario que promueves.</li>
              <li>· No validas ni firmas las ofertas o contratos de tus referidos.</li>
              <li>
                · Informarás por escrito a Dirección si en algún momento alguna de estas condiciones
                cambia.
              </li>
            </ul>
            <p>
              Si tu puesto implica alguna de estas funciones, no eres elegible para el programa y el
              sistema te lo indicará.
            </p>
          </div>
          <label className="mt-4 flex items-start gap-3 rounded-xl bg-secondary p-4">
            <Checkbox
              checked={aceptoCI}
              onCheckedChange={(v) => setAceptoCI(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-negro">
              Leí y acepto esta declaración con mi nombre y firma electrónica.
            </span>
          </label>
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" onClick={() => setModalCI(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!aceptoCI}
              onClick={() => {
                firmar();
                setModalCI(false);
                toast.success("Declaración firmada");
              }}
            >
              Firmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Estados excluyentes: sin persona > pendientes > expediente completo. */
function BadgeExpediente({
  sinPersona,
  pendientes,
  cargando,
}: {
  sinPersona: boolean;
  pendientes: number;
  cargando: boolean;
}) {
  if (sinPersona) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ambar-claro px-3 py-1.5 text-xs font-semibold text-ambar">
        <ShieldAlert className="size-3.5" />
        Sin persona ligada
      </span>
    );
  }
  if (cargando) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-gris">
        <Loader2 className="size-3.5 animate-spin" />
        Revisando expediente
      </span>
    );
  }
  if (pendientes > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ambar-claro px-3 py-1.5 text-xs font-semibold text-ambar">
        <Clock3 className="size-3.5" />
        {pendientes} {pendientes === 1 ? "documento pendiente" : "documentos pendientes"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-verde-claro px-3 py-1.5 text-xs font-semibold text-verde-oscuro">
      <BadgeCheck className="size-3.5" />
      Expediente completo
    </span>
  );
}

function FilaEstado({ n, texto, tono }: { n: number; texto: string; tono: "verde" | "ambar" | "gris" }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn(
          "num flex size-7 items-center justify-center rounded-full text-xs font-bold",
          tono === "verde" && "bg-verde-claro text-verde-oscuro",
          tono === "ambar" && "bg-ambar-claro text-ambar",
          tono === "gris" && "bg-secondary text-gris",
        )}
      >
        {n}
      </span>
      <span className="text-sm text-gris">{texto}</span>
    </li>
  );
}

function Badge({ tono, children }: { tono: "gris" | "verde" | "ambar"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tono === "verde" && "bg-verde-claro text-verde-oscuro",
        tono === "ambar" && "bg-ambar-claro text-ambar",
        tono === "gris" && "bg-secondary text-gris",
      )}
    >
      {children}
    </span>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="eyebrow text-gris">{label}</p>
      <p className="num mt-1 font-semibold text-negro">{valor}</p>
    </div>
  );
}
