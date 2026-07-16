import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Eye,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  Landmark,
  ScrollText,
  History,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/pages/admin/portal-condominio/_helpers";
import { useTitularidadStore } from "./store";
import type {
  AreaAsignada,
  Campo,
  DocumentoExpediente,
  EstadoRegistral,
  SolicitudTitularidad,
} from "./types";
import {
  ChipEstadoValidacion,
  SemaforoIndicator,
  ESTADO_SOLICITUD_LABEL,
  ESTADO_SOLICITUD_TONE,
  AREA_LABEL,
  TIPO_PERSONA_LABEL,
  fmtFechaHora,
} from "./ui";

const TIPO_DOC_LABEL: Record<DocumentoExpediente["tipo"], string> = {
  identificacion: "Identificación oficial",
  escritura: "Escritura pública",
  certificado_rpp: "Certificado RPP",
  predial: "Predial",
  curp_constancia: "Constancia CURP",
  constancia_moral: "Constancia situación fiscal (moral)",
  acta_constitutiva: "Acta constitutiva",
  poder: "Poder notarial",
  id_representante: "ID del representante legal",
};

const REGISTRAL_OPCIONES: { value: EstadoRegistral; label: string }[] = [
  { value: "no_iniciada", label: "No iniciada" },
  { value: "en_gestion", label: "En gestión" },
  { value: "verificado", label: "Verificado" },
  { value: "no_verificable", label: "No verificable" },
];

export default function DetalleTitularidad() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const solicitud = useTitularidadStore((s) => s.solicitudes.find((x) => x.id === id));
  const setUsuario = useTitularidadStore((s) => s.setUsuario);

  useEffect(() => {
    if (profile?.nombre) setUsuario(`${profile.nombre} (revisor)`);
  }, [profile?.nombre, setUsuario]);

  if (!solicitud) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <p>No se encontró la solicitud.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/portal-condominio/titularidad")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Volver a la bandeja
        </Button>
      </div>
    );
  }

  return <DetalleContenido s={solicitud} />;
}

function DetalleContenido({ s }: { s: SolicitudTitularidad }) {
  const navigate = useNavigate();
  const store = useTitularidadStore();
  const [previewDoc, setPreviewDoc] = useState<DocumentoExpediente | null>(null);

  const terminal = s.estado === "aprobada" || s.estado === "rechazada";
  const esModal = s.tipoPersona === "moral";

  // Reglas de habilitación de Nivel 2.
  const faltantesNivel2 = useMemo(() => {
    const faltan: string[] = [];
    if (s.verificacionRegistral !== "verificado") faltan.push("verificación registral (RPP)");
    if (s.cadenaDominioConfirmada !== true) faltan.push("confirmación de cadena de dominio");
    if (esModal && s.poderConFacultadesDominio !== true)
      faltan.push("poder con facultades de dominio (revisión legal)");
    return faltan;
  }, [s.verificacionRegistral, s.cadenaDominioConfirmada, s.poderConFacultadesDominio, esModal]);
  const nivel2Habilitado = faltantesNivel2.length === 0;

  const docNombreById = useMemo(() => {
    const m = new Map<string, string>();
    s.documentos.forEach((d) => m.set(d.id, d.nombreArchivo));
    return m;
  }, [s.documentos]);

  return (
    <div>
      {/* 5.1 Encabezado */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" onClick={() => navigate("/admin/portal-condominio/titularidad")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Bandeja
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                {s.nombreODireccionRazonSocial}
              </h1>
              <StatusBadge label={TIPO_PERSONA_LABEL[s.tipoPersona]} tone="info" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Margot · {s.unidad} · {s.modelo} · Folio real{" "}
              <span className="tabular-nums font-medium text-foreground">{s.folioReal.valor ?? "—"}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono tabular-nums">{s.id}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge label={ESTADO_SOLICITUD_LABEL[s.estado]} tone={ESTADO_SOLICITUD_TONE[s.estado]} />
            <div className="text-[11px] text-muted-foreground text-right">
              Nivel solicitado <span className="font-semibold text-foreground tabular-nums">{s.nivelSolicitado}</span>
              {s.nivelOtorgado != null && (
                <> · Otorgado <span className="font-semibold text-success tabular-nums">{s.nivelOtorgado}</span></>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground text-right">
              Área: {s.areaAsignada ? AREA_LABEL[s.areaAsignada] : "sin asignar"} · {s.diasEnCola} días en cola
            </div>
            <SemaforoIndicator s={s.semaforoAgregado} />
          </div>
        </div>
        {terminal && (
          <div
            className={cn(
              "mt-4 rounded-lg border px-3 py-2 text-sm",
              s.estado === "aprobada"
                ? "border-success/30 bg-success/10 text-success"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {s.estado === "aprobada"
              ? `Solicitud aprobada — Nivel ${s.nivelOtorgado} reconocido para administración.`
              : `Solicitud rechazada. ${s.motivoRechazo ?? ""}`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Columna izquierda: datos + documentos + cruces + gravamen */}
        <div className="lg:col-span-2 space-y-4">
          {/* 5.2 Datos del solicitante y propiedad */}
          <Section title="Datos del solicitante y de la propiedad" icon={Building2}>
            <div className="divide-y divide-border">
              {s.tipoPersona === "moral" ? (
                <>
                  <CampoRow label="Razón social" campo={s.razonSocial} docNombreById={docNombreById} />
                  <CampoRow label="RFC (12 dígitos)" campo={s.rfc} docNombreById={docNombreById} mono />
                  <div className="py-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Representante legal
                    </p>
                    <div className="divide-y divide-border rounded-md border border-border">
                      <div className="px-2"><CampoRow label="Nombre" campo={s.representanteLegal?.nombre} docNombreById={docNombreById} /></div>
                      <div className="px-2"><CampoRow label="CURP" campo={s.representanteLegal?.curp} docNombreById={docNombreById} mono /></div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <CampoRow label="Nombre" campo={{ valor: s.nombreODireccionRazonSocial, estado: "validado", idDocumentoFuente: null }} docNombreById={docNombreById} />
                  <CampoRow label="CURP" campo={s.curp} docNombreById={docNombreById} mono />
                  <CampoRow label="RFC" campo={s.rfc} docNombreById={docNombreById} mono />
                </>
              )}
              <InfoRow label="Correo (verificado)" value={s.correo} />
              <InfoRow label="Teléfono" value={s.telefono} />
              <InfoRow label="Unidad" value={`Margot · ${s.unidad} · ${s.modelo}`} />
              <CampoRow label="Folio real" campo={s.folioReal} docNombreById={docNombreById} mono />
              <InfoRow label="Dirección" value={s.direccion} />
              <InfoRow label="Contexto de compra" value={s.contextoCompra === "contado" ? "Contado" : "Crédito hipotecario"} />
            </div>
          </Section>

          {/* 5.3 Documentos del expediente */}
          <Section title="Documentos del expediente" icon={ScrollText}>
            <div className="space-y-2.5">
              {s.documentos.map((d) => (
                <DocumentoCard
                  key={d.id}
                  d={d}
                  disabled={terminal}
                  onPreview={() => setPreviewDoc(d)}
                  onEstado={(estado, motivo) => store.setDocumentoEstado(s.id, d.id, estado, motivo)}
                />
              ))}
            </div>
          </Section>

          {/* 5.4 Panel de cruces automáticos */}
          <Section title="Cruces automáticos" icon={ShieldCheck}>
            <p className="text-[11px] text-muted-foreground mb-3">
              Señales para la revisión humana. No aprueban ni rechazan por sí solas: un cruce en verde no prueba
              cadena limpia, ni uno en rojo prueba fraude.
            </p>
            <div className="space-y-2">
              {[...s.cruces].sort((a, b) => Number(!!b.esCadenaDominio) - Number(!!a.esCadenaDominio)).map((cruce) => (
                <div
                  key={cruce.id}
                  className={cn(
                    "rounded-lg border p-3",
                    cruce.esCadenaDominio ? "border-primary/40 bg-primary/[0.04]" : "border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {cruce.esCadenaDominio && (
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-0.5">
                          Cadena de dominio — enajenante en escritura vs. dueño original registrado por SOZU
                        </p>
                      )}
                      <p className="text-sm font-medium">{cruce.etiqueta}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{cruce.detalle}</p>
                      {cruce.esCadenaDominio && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded border border-border px-2 py-1">
                            <span className="text-muted-foreground">Enajenante (escritura): </span>
                            <span className="font-medium">{enajenanteDe(s) ?? "—"}</span>
                          </div>
                          <div className="rounded border border-border px-2 py-1">
                            <span className="text-muted-foreground">Dueño original (SOZU): </span>
                            <span className="font-medium">{s.duenoOriginalRegistrado}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <SemaforoIndicator s={cruce.resultado} withLabel={false} />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 5.5 Gravamen */}
          <Section title="Gravamen / hipoteca" icon={Landmark}>
            {s.gravamen.existe ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium">Hipoteca inscrita · Acreedor: {s.gravamen.acreedor}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  El gravamen es normal en compra financiada; no descalifica. Condiciona Nivel 2.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin gravámenes declarados en el expediente.</p>
            )}
          </Section>
        </div>

        {/* Columna derecha: verificación humana + decisión + auditoría */}
        <div className="space-y-4">
          {/* 5.6 Verificación humana */}
          <div className="rounded-xl border-2 border-primary/30 bg-primary/[0.03] p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">Verificación humana</h3>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Lo que la automatización NO hace. Responsabilidad legal del revisor.
            </p>

            {/* Verificación registral */}
            <div className="mb-4">
              <p className="text-xs font-semibold mb-1.5">Verificación registral</p>
              <div className="grid grid-cols-2 gap-1.5">
                {REGISTRAL_OPCIONES.map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    disabled={terminal}
                    onClick={() => store.setVerificacionRegistral(s.id, op.value)}
                    className={cn(
                      "h-8 rounded-md border text-[12px] font-medium transition-colors disabled:opacity-50",
                      s.verificacionRegistral === op.value
                        ? op.value === "verificado"
                          ? "border-success bg-success/10 text-success"
                          : op.value === "no_verificable"
                            ? "border-destructive bg-destructive/10 text-destructive"
                            : "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={terminal}
                className="h-8 mt-2 w-full text-[12px]"
                onClick={() => store.setVerificacionRegistral(s.id, "en_gestion")}
              >
                Gestionar con SOZU
              </Button>
              {/* SWAP POINT: verificación/gestión registral real (integración con RPP de Jalisco,
                  notario aliado, o proceso manual con responsable y SLA). Aplica Código Civil de
                  Jalisco, competencia estatal. */}
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Confirmación del certificado RPP por folio real. Esta acción distingue a un dueño real de una
                escritura falsificada — no es un checkbox.
              </p>
            </div>

            {/* Revisión del poder (solo moral) */}
            {esModal && (
              <div className="mb-4">
                <p className="text-xs font-semibold mb-1.5">¿Poder con facultades de actos de dominio?</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { v: true as const, label: "Sí" },
                    { v: false as const, label: "No" },
                    { v: null, label: "Pendiente" },
                  ].map((op) => (
                    <button
                      key={String(op.v)}
                      type="button"
                      disabled={terminal}
                      onClick={() => store.setPoderFacultades(s.id, op.v)}
                      className={cn(
                        "h-8 rounded-md border text-[12px] font-medium transition-colors disabled:opacity-50",
                        s.poderConFacultadesDominio === op.v
                          ? op.v === true
                            ? "border-success bg-success/10 text-success"
                            : op.v === false
                              ? "border-destructive bg-destructive/10 text-destructive"
                              : "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
                {/* SWAP POINT: validación legal del poder */}
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Vigencia y no-revocación son análisis legal, no OCR.
                </p>
              </div>
            )}

            {/* Confirmación de cadena de dominio */}
            <label className={cn("flex items-start gap-2 cursor-pointer", terminal && "opacity-60 cursor-default")}>
              <input
                type="checkbox"
                disabled={terminal}
                checked={s.cadenaDominioConfirmada === true}
                onChange={(e) => store.setCadenaDominioConfirmada(s.id, e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-[#57ae75]"
              />
              <span className="text-xs">
                <span className="font-medium">Cadena de dominio confirmada por revisor</span>
                <span className="block text-[11px] text-muted-foreground">
                  Independiente del semáforo automático.
                </span>
              </span>
            </label>
          </div>

          {/* 5.7 Decisión */}
          <DecisionBlock s={s} terminal={terminal} nivel2Habilitado={nivel2Habilitado} faltantesNivel2={faltantesNivel2} />

          {/* 5.9 Auditoría */}
          <Section title="Auditoría de la solicitud" icon={History}>
            <p className="text-[11px] text-muted-foreground mb-3">Registro append-only. Ninguna acción edita o borra entradas previas.</p>
            <ol className="space-y-3">
              {[...s.auditoria].reverse().map((e) => (
                <li key={e.id} className="relative pl-4">
                  <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary/60" />
                  <p className="text-[13px] font-medium leading-tight">{e.accion}</p>
                  <p className="text-[11px] text-muted-foreground">{e.detalle}</p>
                  <p className="text-[10px] text-muted-foreground/70 tabular-nums mt-0.5">
                    {e.usuario} · {fmtFechaHora(e.timestamp)}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>

      {/* Preview de documento (mock) */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewDoc ? TIPO_DOC_LABEL[previewDoc.tipo] : "Documento"}</DialogTitle>
            <DialogDescription className="font-mono tabular-nums text-xs">
              {previewDoc?.nombreArchivo}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-dashed border-border bg-muted/30 h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <FileText className="h-10 w-10 opacity-40" />
            <p className="text-sm">Vista previa no disponible en demo</p>
            {/* SWAP POINT: preview real del documento desde almacenamiento seguro */}
            <p className="text-[11px] font-mono">{previewDoc?.urlMock}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Enajenante extraído de la escritura (para el cruce de cadena de dominio).
function enajenanteDe(s: SolicitudTitularidad): string | null {
  const esc = s.documentos.find((d) => d.tipo === "escritura");
  return esc?.datosExtraidos?.enajenante?.valor ?? null;
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

function CampoRow<T extends string>({
  label,
  campo,
  docNombreById,
  mono,
}: {
  label: string;
  campo: Campo<T> | undefined;
  docNombreById: Map<string, string>;
  mono?: boolean;
}) {
  if (!campo) return null;
  const doc = campo.idDocumentoFuente ? docNombreById.get(campo.idDocumentoFuente) : null;
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs text-muted-foreground pt-0.5">{label}</span>
      <div className="text-right min-w-0">
        <div className="flex items-center justify-end gap-2">
          <span className={cn("text-sm", mono && "font-mono tabular-nums", !campo.valor && "text-muted-foreground italic")}>
            {campo.valor ?? "—"}
          </span>
          <ChipEstadoValidacion estado={campo.estado} />
        </div>
        {doc && <p className="text-[10px] text-muted-foreground/70 mt-0.5">Tomado de: {doc}</p>}
      </div>
    </div>
  );
}

function DocumentoCard({
  d,
  disabled,
  onPreview,
  onEstado,
}: {
  d: DocumentoExpediente;
  disabled: boolean;
  onPreview: () => void;
  onEstado: (estado: DocumentoExpediente["estado"], motivo?: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [motivo, setMotivo] = useState("");
  const faltante = d.requerimiento === "pendiente";
  const datos = Object.entries(d.datosExtraidos);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[13px] font-medium">{TIPO_DOC_LABEL[d.tipo]}</span>
            <ChipEstadoValidacion estado={d.estado} />
            {d.requerimiento === "pendiente" && <StatusBadge label="Requerido" tone="warning" />}
            {d.requerimiento === "opcional" && <StatusBadge label="Opcional" tone="default" />}
            {d.vigencia === "expirado" && <StatusBadge label="Expirado" tone="danger" />}
            {d.vigencia === "por_vencer" && <StatusBadge label="Por vencer" tone="warning" />}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono tabular-nums mt-0.5 truncate">{d.nombreArchivo}</p>
        </div>
        {!faltante && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-primary shrink-0" onClick={onPreview}>
            <Eye className="h-3.5 w-3.5 mr-1" /> Ver
          </Button>
        )}
      </div>

      {datos.length > 0 && (
        <div className="mt-2 rounded-md border border-border/60 divide-y divide-border/60">
          {datos.map(([k, campo]) => (
            <div key={k} className="flex items-center justify-between gap-3 px-2 py-1">
              <span className="text-[11px] text-muted-foreground capitalize">{k}</span>
              <span className="flex items-center gap-1.5">
                <span className={cn("text-[12px]", !campo.valor && "text-muted-foreground italic")}>{campo.valor ?? "—"}</span>
                <ChipEstadoValidacion estado={campo.estado} />
              </span>
            </div>
          ))}
        </div>
      )}

      {d.motivoRechazo && d.estado === "rechazado" && (
        <p className="text-[11px] text-destructive mt-2">Rechazo: {d.motivoRechazo}</p>
      )}

      {!disabled && !faltante && (
        <>
          <div className="flex gap-1.5 mt-2">
            <Button
              size="sm"
              variant={d.estado === "validado" ? "default" : "outline"}
              className="h-7 px-2 text-[11px] gap-1"
              onClick={() => onEstado("validado")}
            >
              <CheckCircle2 className="h-3 w-3" /> Validar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] gap-1"
              onClick={() => onEstado("por_confirmar")}
            >
              <HelpCircle className="h-3 w-3" /> Por confirmar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] gap-1 border-destructive/40 text-destructive hover:bg-destructive/5"
              onClick={() => setRejecting((v) => !v)}
            >
              <XCircle className="h-3 w-3" /> Rechazar
            </Button>
          </div>
          {rejecting && (
            <div className="mt-2 space-y-1.5">
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Motivo del rechazo (obligatorio)…"
                className="text-[12px]"
              />
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 px-2 text-[11px]"
                  disabled={!motivo.trim()}
                  onClick={() => {
                    onEstado("rechazado", motivo.trim());
                    setRejecting(false);
                    setMotivo("");
                  }}
                >
                  Confirmar rechazo
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => { setRejecting(false); setMotivo(""); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const AREAS: AreaAsignada[] = ["legal", "escrituracion", "administracion", "cobranza"];

function DecisionBlock({
  s,
  terminal,
  nivel2Habilitado,
  faltantesNivel2,
}: {
  s: SolicitudTitularidad;
  terminal: boolean;
  nivel2Habilitado: boolean;
  faltantesNivel2: string[];
}) {
  const store = useTitularidadStore();
  const [modo, setModo] = useState<null | "rechazo" | "info">(null);
  const [texto, setTexto] = useState("");

  if (terminal) {
    return (
      <Section title="Decisión" icon={CheckCircle2}>
        <p className="text-sm text-muted-foreground">
          Solicitud en estado terminal (<span className="font-medium">{ESTADO_SOLICITUD_LABEL[s.estado]}</span>). La decisión ya fue registrada en la auditoría.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Decisión" icon={CheckCircle2}>
      {/* Ruteo por área */}
      <div className="mb-3">
        <p className="text-xs font-semibold mb-1.5">Asignar / rutear</p>
        <div className="flex flex-wrap gap-1.5">
          {AREAS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => store.asignarArea(s.id, a)}
              className={cn(
                "h-8 px-2.5 rounded-md border text-[12px] font-medium transition-colors",
                s.areaAsignada === a
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {AREA_LABEL[a]}
            </button>
          ))}
        </div>
      </div>

      {/* Aprobar — nivel */}
      <div className="mb-3">
        <p className="text-xs font-semibold mb-1.5">Aprobar con nivel</p>
        {/* SWAP POINT: control de roles/permisos server-side (RLS). La aprobación
            de Nivel 2 debe habilitarla únicamente el rol legal. */}
        <div className="flex gap-2">
          <Button
            className="flex-1 h-9 text-[13px] gap-1.5 bg-success hover:bg-success/90"
            onClick={() => store.aprobar(s.id, 1)}
          >
            <ShieldCheck className="h-4 w-4" /> Aprobar Nivel 1
          </Button>
          <div className="flex-1" title={nivel2Habilitado ? undefined : `Falta: ${faltantesNivel2.join(", ")}`}>
            <Button
              className="w-full h-9 text-[13px] gap-1.5 bg-success hover:bg-success/90"
              disabled={!nivel2Habilitado}
              onClick={() => store.aprobar(s.id, 2)}
            >
              <ShieldCheck className="h-4 w-4" /> Aprobar Nivel 2
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Nivel 1: titularidad provisional (identificación + escritura + match de propiedad) para administración/cobro de
          mantenimiento, aun sin RPP verificado.
          {/* SWAP POINT / DECISIÓN LEGAL ABIERTA: ¿el área legal autoriza cobrar mantenimiento en
              Nivel 1 antes de confirmar titularidad al 100%? Debe ser decisión explícita de legal. */}
        </p>
        {!nivel2Habilitado && (
          <p className="text-[11px] text-warning mt-1">
            Nivel 2 requiere: {faltantesNivel2.join(", ")}.
          </p>
        )}
      </div>

      {/* Rechazar / Solicitar info */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 h-9 text-[13px] gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/5" onClick={() => { setModo(modo === "rechazo" ? null : "rechazo"); setTexto(""); }}>
          <XCircle className="h-4 w-4" /> Rechazar
        </Button>
        <Button variant="outline" className="flex-1 h-9 text-[13px] gap-1.5" onClick={() => { setModo(modo === "info" ? null : "info"); setTexto(""); }}>
          <HelpCircle className="h-4 w-4" /> Pedir documentación
        </Button>
      </div>

      {modo && (
        <div className="mt-2 space-y-1.5">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder={modo === "rechazo" ? "Motivo del rechazo (obligatorio, visible al solicitante)…" : "Qué documentación falta (nota al solicitante)…"}
            className="text-[12px]"
          />
          <Button
            size="sm"
            variant={modo === "rechazo" ? "destructive" : "default"}
            className="h-8 text-[12px]"
            disabled={!texto.trim()}
            onClick={() => {
              if (modo === "rechazo") store.rechazar(s.id, texto.trim());
              else store.solicitarInfo(s.id, texto.trim());
              setModo(null);
              setTexto("");
            }}
          >
            {modo === "rechazo" ? "Confirmar rechazo" : "Enviar solicitud de info"}
          </Button>
        </div>
      )}

      {/* 5.8 Efectos de la aprobación (mock) */}
      <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Efectos al aprobar (en producción)
        </p>
        <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
          {/* SWAP POINT: transferir el registro de la unidad del dueño anterior (p.ej. "Hevi Holding")
              al nuevo titular en la fuente única de titularidad, y finalizar la obligación de
              mantenimiento del anterior a la fecha de transferencia. */}
          <li>Transferir el registro de la unidad de "{s.duenoOriginalRegistrado}" al nuevo titular y dar de baja su obligación de mantenimiento a la fecha de transferencia.</li>
          {/* SWAP POINT: activar la cuenta del nuevo cliente y desbloquear su onboarding (Paso 7 / Transferencia). */}
          <li>Activar la cuenta del nuevo cliente y desbloquear su onboarding (Paso 7 / Transferencia).</li>
          {/* SWAP POINT: notificar al solicitante (correo / WhatsApp) el resultado. */}
          <li>Notificar al solicitante (correo / WhatsApp): aprobado Nivel X · rechazado con motivo · falta documentación.</li>
        </ul>
      </div>
    </Section>
  );
}
