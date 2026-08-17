import {Link} from "react-router-dom";
import { useState } from "react";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { usePortal } from "@/lib/portal-personal/portal-store";
import { selectores } from "@/lib/portal-personal/selectores";
import { EXPEDIENTE, REGLAS } from "@/lib/portal-personal/mock";
import { LinkReferido } from "@/components/admin/portal-personal/comunes/LinkReferido";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AvatarColaborador } from "@/components/admin/portal-personal/comunes/Avatar";
import { cn } from "@/lib/utils";


type ClaveSeccion =
  | "cuenta"
  | "identidad"
  | "documentos"
  | "deposito"
  | "reglas"
  | "conflicto"
  | "desarrollos"
  | "bitacora"
  | "seguridad";

export default function PerfilPage() {
  const usuario = usePortal((s) => s.usuario);
  const modo = usePortal((s) => s.modo_presentacion);
  const logs = usePortal((s) => s.logs);
  const firmar = usePortal((s) => s.firmarConflictoInteres);
  const registrarLog = usePortal((s) => s.registrarLog);

  const [abierta, setAbierta] = useState<ClaveSeccion | null>(null);
  const [modalCI, setModalCI] = useState(false);
  const [clabeVisible, setClabeVisible] = useState(false);
  const [aceptoCI, setAceptoCI] = useState(false);

  const oculto = (v: string) => (modo ? "••••••" : v);
  const pendientes = selectores.pendientesDeElegibilidad(usuario);
  const inelegible = !usuario.elegible_referidos;

  const clabeEnmascarada = `···· ···· ···· ·· ${usuario.clabe.slice(-4)}`;
  const clabeCoincide = usuario.clabe_valida && usuario.titular_clabe === usuario.nombre;

  const secciones: {
    clave: ClaveSeccion;
    titulo: string;
    descripcion: string;
    badge: { texto: string; tono: "gris" | "verde" | "ambar" };
  }[] = [
    {
      clave: "cuenta",
      titulo: "Datos de tu cuenta",
      descripcion: "Tipo de colaborador, puesto, equipo y fecha de alta",
      badge: { texto: "Solo lectura", tono: "gris" },
    },
    {
      clave: "identidad",
      titulo: "Identidad",
      descripcion: "Datos personales, RFC y CURP",
      badge: { texto: "Completado", tono: "verde" },
    },
    {
      clave: "documentos",
      titulo: "Documentos",
      descripcion: "Sube y consulta todos tus documentos",
      badge: { texto: "Pendiente", tono: "ambar" },
    },
    {
      clave: "deposito",
      titulo: "Cuenta de depósito",
      descripcion: "Banco, CLABE y titular",
      badge: usuario.cuenta_bancaria_confirmada
        ? { texto: "Completado", tono: "verde" }
        : { texto: "Pendiente", tono: "ambar" },
    },
    {
      clave: "reglas",
      titulo: "Reglas del Programa",
      descripcion: `Consulta y acepta las reglas vigentes (v${REGLAS.version})`,
      badge:
        usuario.reglas_aceptadas_version === REGLAS.version
          ? { texto: "Completado", tono: "verde" }
          : { texto: "Pendiente", tono: "ambar" },
    },
    {
      clave: "conflicto",
      titulo: "Declaración de conflicto de interés",
      descripcion: usuario.conflicto_interes_firmado_en
        ? `Firmada el ${new Date(usuario.conflicto_interes_firmado_en).toLocaleDateString("es-MX")}`
        : "Pendiente de firma",
      badge: usuario.conflicto_interes_firmado_en
        ? { texto: "Completado", tono: "verde" }
        : { texto: "Pendiente", tono: "ambar" },
    },
    {
      clave: "desarrollos",
      titulo: "Desarrollos asignados",
      descripcion: usuario.desarrollos_asignados.join(", "),
      badge: { texto: "Solo lectura", tono: "gris" },
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
      badge: { texto: "Solo lectura", tono: "gris" },
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Identidad + activación */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="card-sozu p-6">
          <div className="flex flex-wrap items-start gap-5">
            <div className="relative">
              <AvatarColaborador
                nombre={usuario.nombre}
                foto={usuario.foto_url}
                enmascarado={modo}
                className="size-20 text-xl"
              />
              <button
                type="button"
                aria-label="Cambiar fotografía"
                onClick={() => toast.success("Selecciona una nueva fotografía")}
                className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border border-border bg-background text-gris shadow-sm"
              >
                <Camera className="size-4" />
              </button>
            </div>
            <div className="flex-1">
              <h2 className="text-[26px] font-bold leading-tight text-negro">
                {oculto(usuario.nombre)}
              </h2>
              <p className="text-sm text-gris">
                {usuario.rol} · {usuario.subrol}
              </p>
              <p className="num mt-1 text-sm text-gris">
                {oculto(usuario.correo)} · {oculto(usuario.telefono)}
              </p>
            </div>
            <BadgeElegibilidad inelegible={inelegible} pendientes={pendientes.length} />
          </div>

          {inelegible && usuario.motivo_inelegibilidad && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-rojo-borde bg-rojo-claro p-4">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rojo" />
              <p className="text-sm text-negro">{usuario.motivo_inelegibilidad}</p>
            </div>
          )}

          <div className="mt-6">
            <LinkReferido variante="barra" />
          </div>
        </section>

        <section className="card-sozu p-6">
          <p className="eyebrow text-gris">Activación</p>
          <p className="num mt-1 text-[40px] font-bold leading-none text-verde">
            {usuario.activacion_pct}%
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-verde"
              style={{ width: `${usuario.activacion_pct}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-gris">
            Se calcula sobre documentos validados y etapas completadas.
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
              <Button
                variant="outline"
                className="bg-background"
                onClick={() => setAbierta("documentos")}
              >
                <FileText className="size-4" />
                Gestionar documentos
              </Button>
              <span className="num text-sm text-gris">
                {EXPEDIENTE.validadas} de {EXPEDIENTE.secciones_totales} secciones completadas
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-background p-4">
            <p className="eyebrow text-gris">Estado de secciones</p>
            <ul className="mt-3 space-y-3">
              <FilaEstado n={EXPEDIENTE.validadas} texto="validadas" tono="verde" />
              <FilaEstado n={EXPEDIENTE.en_proceso} texto="en proceso" tono="ambar" />
              <FilaEstado n={EXPEDIENTE.pendientes} texto="pendientes" tono="gris" />
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
                      <Campo
                        label="Tipo de colaborador"
                        valor={usuario.tipo_colaborador.replace(/_/g, " ")}
                      />
                      <Campo label="Puesto" valor={usuario.subrol} />
                      <Campo label="Equipo" valor={usuario.rol} />
                      <Campo
                        label="Fecha de alta"
                        valor={new Date(usuario.auditoria.creado_en).toLocaleDateString("es-MX")}
                      />
                    </div>
                  )}

                  {s.clave === "identidad" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Campo label="Nombre completo" valor={oculto(usuario.nombre)} />
                      <Campo label="Correo" valor={oculto(usuario.correo)} />
                      <Campo label="RFC" valor={oculto(usuario.rfc)} />
                      <Campo label="CURP" valor={oculto(usuario.curp)} />
                    </div>
                  )}

                  {s.clave === "documentos" && (
                    <div className="space-y-3">
                      {/* SWAP POINT: supabase.documentos_expediente */}
                      {[
                        ["Identificación oficial", "Validado"],
                        ["Constancia de situación fiscal", "Validado"],
                        ["Comprobante de domicilio", "Validado"],
                        ["Estado de cuenta con CLABE", "Validado"],
                        ["CURP", "En proceso"],
                        ["Carta de conflicto de interés", "En proceso"],
                      ].map(([nombre, estado]) => (
                        <div
                          key={nombre}
                          className="flex items-center justify-between rounded-xl border border-border p-3"
                        >
                          <span className="text-sm text-negro">{nombre}</span>
                          <Badge tono={estado === "Validado" ? "verde" : "ambar"}>
                            {estado as string}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.clave === "deposito" && (
                    <div>
                      <p className="text-sm text-gris">
                        Tus ganancias se depositan aquí. El nombre del titular debe coincidir con
                        tu RFC.
                      </p>
                      <div className="mt-4 flex items-center gap-2">
                        <p className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 font-mono text-sm tracking-wider text-negro">
                          {clabeVisible && !modo ? usuario.clabe : clabeEnmascarada}
                        </p>
                        {!modo && (
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
                            {clabeVisible ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </Button>
                        )}
                      </div>

                      {/* SWAP POINT: validacion_clabe */}
                      {usuario.clabe_valida ? (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-verde-oscuro">
                          <CheckCircle2 className="size-3.5" />
                          18 dígitos válidos · {usuario.banco}
                        </p>
                      ) : (
                        <p className="mt-3 text-xs text-rojo">La CLABE no es válida</p>
                      )}

                      <div className="mt-4">
                        <Campo label="Titular" valor={oculto(usuario.titular_clabe)} />
                      </div>

                      {clabeCoincide ? (
                        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-verde-claro px-3 py-1.5 text-xs font-semibold text-verde-oscuro">
                          <CheckCircle2 className="size-3.5" />
                          Cuenta confirmada
                        </p>
                      ) : (
                        <div className="mt-4 rounded-xl border border-rojo-borde bg-rojo-claro p-4">
                          <p className="inline-flex items-center gap-2 text-xs font-semibold text-rojo">
                            <ShieldAlert className="size-3.5" />
                            La CLABE no corresponde a tu RFC
                          </p>
                          <p className="mt-2 text-sm text-negro">
                            El pago queda bloqueado hasta que el titular de la cuenta coincida con
                            el RFC declarado. Sube un estado de cuenta a tu nombre en Documentos y
                            el expediente se actualizará.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

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
                      {usuario.conflicto_interes_firmado_en ? (
                        <p className="num mt-4 inline-flex items-center gap-2 rounded-full bg-verde-claro px-3 py-1.5 text-xs font-semibold text-verde-oscuro">
                          <CheckCircle2 className="size-3.5" />
                          Firmada el{" "}
                          {new Date(usuario.conflicto_interes_firmado_en).toLocaleDateString(
                            "es-MX",
                          )}
                        </p>
                      ) : (
                        <Button className="mt-4" onClick={() => setModalCI(true)}>
                          Firmar declaración
                        </Button>
                      )}
                    </div>
                  )}

                  {s.clave === "desarrollos" && (
                    <div className="flex flex-wrap gap-2">
                      {usuario.desarrollos_asignados.map((d) => (
                        <span
                          key={d}
                          className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-negro"
                        >
                          {d}
                        </span>
                      ))}
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
                      <Campo label="Último acceso" valor={usuario.ultimo_acceso} />
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
            <p>
              Puedes referir a familiares, amigos y conocidos. Ese es el propósito del programa.
            </p>
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
                · Informarás por escrito a Dirección si en algún momento alguna de estas
                condiciones cambia.
              </li>
            </ul>
            <p>
              Si tu puesto implica alguna de estas funciones, no eres elegible para el programa y
              el sistema te lo indicará.
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

/** Estados excluyentes: inelegible > pendientes > activo (Parte A, 3.1). */
function BadgeElegibilidad({
  inelegible,
  pendientes,
}: {
  inelegible: boolean;
  pendientes: number;
}) {
  if (inelegible) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rojo-claro px-3 py-1.5 text-xs font-semibold text-rojo">
        <ShieldAlert className="size-3.5" />
        No elegible
      </span>
    );
  }
  if (pendientes > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ambar-claro px-3 py-1.5 text-xs font-semibold text-ambar">
        <Clock3 className="size-3.5" />
        {pendientes} {pendientes === 1 ? "paso pendiente" : "pasos pendientes"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-verde-claro px-3 py-1.5 text-xs font-semibold text-verde-oscuro">
      <BadgeCheck className="size-3.5" />
      Elegible para referir
    </span>
  );
}

function FilaEstado({
  n,
  texto,
  tono,
}: {
  n: number;
  texto: string;
  tono: "verde" | "ambar" | "gris";
}) {
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

function Badge({
  tono,
  children,
}: {
  tono: "gris" | "verde" | "ambar";
  children: React.ReactNode;
}) {
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
