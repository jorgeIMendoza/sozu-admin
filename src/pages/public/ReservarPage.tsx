import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import {
  RESERVATION_TOKEN_PARAM,
  cargarReservacionPublica,
  parseReservationToken,
  LINK_NO_VIGENTE,
} from "@/lib/offers/reservation-token";
import sozuLogo from "@/assets/sozu-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import { useOfferById, formatMXN } from "@/lib/offers/offer-data";
import { apartadoDeOferta } from "@/lib/offers/apartado";
import {
  consultarEstadoApartado,
  type EstadoApartado,
} from "@/lib/offers/apartado-status";
import { useOfferFromDB } from "@/lib/offers/use-offer-db";
import { useAgentById, type Agent } from "@/lib/offers/agent-data";
import { getPortalLoginUrl } from "@/lib/portalUrls";
import PublicShell from "@/components/offer/PublicShell";
import OfferFooter from "@/components/offer/OfferFooter";
import ApartadoPagadoDialog from "@/components/offer/ApartadoPagadoDialog";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Landmark,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

// Apartado por transferencia SPEI (sin Stripe). El monto es por proyecto
// (`proyectos.monto_apartado`) y viaja en la oferta: ver lib/offers/apartado.ts.
// Beneficiario STP fijo (mismo que PagoApartadoFinalPage / plantillas PDF).
const BENEFICIARIO = "SOZU COMERCIALIZADORA SA DE CV";
const BANCO = "STP (646)";
// Botón demo para recorrer el flujo internamente sin transferencia real.
// SOLO en desarrollo: en un build de producción no existe, para que nadie pueda
// marcar un apartado como pagado sin la transferencia SPEI.
const SHOW_DEMO_PAY_BUTTON = import.meta.env.DEV;
// Validación del pago: el depósito aparece en la plataforma en ~30 segundos, así que
// se consulta cada 30 s. 10 intentos ≈ 5 minutos, el techo que se le promete al cliente;
// después se ofrece contactar al asesor. Con movimientos ya visibles no se agota (ver
// runCheck): el pago está en curso.
const MAX_ATTEMPTS = 10;
const CHECK_INTERVAL_MS = 30_000;
// Login del portal cliente (cross-subdominio, honra dev/prod). Ej. prod:
// https://clientes.sozu.com/auth/login · dev: https://clientes-dev.sozu.com/auth/login
const CLIENT_PORTAL_LOGIN_URL = getPortalLoginUrl("clientes");

type PayFlow = "waiting" | "checking" | "paid" | "exhausted";

/** Mismo enmascarado que devuelve el RPC, para el fallback local (demo). */
const enmascararEmail = (email?: string | null) => {
  if (!email || !email.includes("@")) return null;
  const [usuario, dominio] = email.split("@");
  return `${usuario.slice(0, 1)}***@${dominio}`;
};

// Botón de copiar reutilizable (CLABE / monto / concepto).
const CopyButton = ({ copied, onClick, compact }: { copied: boolean; onClick: () => void; compact?: boolean }) =>
  compact ? (
    <button
      type="button"
      onClick={onClick}
      aria-label="Copiar"
      className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
    >
      {copied ? <CheckCircle2 className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
    </button>
  ) : (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card border border-border text-[11px] font-semibold text-foreground hover:border-primary/40 transition-colors"
    >
      {copied ? <CheckCircle2 className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );

// Tarjeta "contacta a tu asesor" — datos de quien generó la oferta.
const AdvisorContactCard = ({ agent }: { agent?: Agent }) => {
  if (!agent) return null;
  const tel = agent.phone?.replace(/\s+/g, "");
  const wa = agent.whatsapp?.replace(/\D/g, "");
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-white border border-border shrink-0 overflow-hidden flex items-center justify-center">
          <img src={agent.photoUrl || sozuLogo} alt={agent.fullName} className="w-full h-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-muted-foreground/60 leading-none mb-0.5">Tu asesor</p>
          <p className="text-sm font-semibold text-foreground truncate">{agent.fullName}</p>
          {agent.title && <p className="text-[11px] text-muted-foreground truncate">{agent.title}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
        )}
        <div className="grid grid-cols-2 gap-2">
          {tel && (
            <a
              href={`tel:${tel}`}
              className="h-10 rounded-lg border border-border bg-card text-xs font-semibold text-foreground flex items-center justify-center gap-2 hover:border-primary/40 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" /> Llamar
            </a>
          )}
          {agent.email && (
            <a
              href={`mailto:${agent.email}`}
              className="h-10 rounded-lg border border-border bg-card text-xs font-semibold text-foreground flex items-center justify-center gap-2 hover:border-primary/40 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" /> Email
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

const SpeiPayPanel = ({
  formalReservationId,
  offerId,
  montoApartado,
  clabe,
  concepto,
  agent,
  clientEmail,
  reservationToken,
  onPaid,
}: {
  formalReservationId: string;
  offerId: string;
  /** Monto del apartado del proyecto, ya resuelto por el padre desde la oferta. */
  montoApartado: number;
  clabe?: string;
  concepto: string;
  agent?: Agent;
  clientEmail?: string;
  /** Token del link personal del cliente: credencial de las RPC públicas. */
  reservationToken?: string | null;
  onPaid?: () => void;
}) => {
  const recordPayment = useFormalReservationStore((s) => s.recordPayment);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [flow, setFlow] = useState<PayFlow>("waiting");
  const [attempts, setAttempts] = useState(0);
  const [paidStatus, setPaidStatus] = useState<EstadoApartado | null>(null);
  // Último estado leído (pagado o no): de aquí salen los movimientos en vivo.
  const [estado, setEstado] = useState<EstadoApartado | null>(null);
  const [paidDialogOpen, setPaidDialogOpen] = useState(false);

  const clabeFormatted = clabe ? clabe.match(/.{1,4}/g)?.join(" ") ?? clabe : "";

  const copy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField((k) => (k === key ? null : k)), 2000);
  };

  // Marca el pago en el store local (expediente) al confirmarse.
  const markPaidLocally = useCallback(() => {
    recordPayment(formalReservationId, {
      id: `PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      amountMXN: montoApartado,
      paymentMethod: "spei",
      detectedAt: new Date().toISOString(),
      speiTrackingKey: `MBAN${Date.now().toString().slice(-10)}${Math.random()
        .toString(36)
        .substring(2, 5)
        .toUpperCase()}`,
    });
  }, [recordPayment, formalReservationId, montoApartado]);

  // Consulta a BD (RPC SECURITY DEFINER) si el apartado ya se reflejó pagado.
  // El pago es vía SPEI (externo): se valida contra el estado real en plataforma.
  // Cadena real: STP → backend → RPC insertar_pago_stp → n8n crea cuenta de cobranza
  // + pagos → triggers suben la propiedad a estatus 4. Aquí solo se lee ese estado.
  // Sin token la RPC responde vacío (fallo cerrado): el estado del pago solo se
  // consulta desde el link personal del cliente.
  const consultarApartado = useCallback(async (): Promise<EstadoApartado | null> => {
    const numericId = Number(offerId);
    if (!numericId || Number.isNaN(numericId)) return null;
    const e = await consultarEstadoApartado(numericId, reservationToken);
    if (e) setEstado(e);
    return e;
  }, [offerId, reservationToken]);

  /** Estado del apartado solo si ya está pagado; si no, null. */
  const checkPaidInDB = useCallback(async (): Promise<EstadoApartado | null> => {
    const e = await consultarApartado();
    return e?.pagado ? e : null;
  }, [consultarApartado]);

  // Al confirmarse el pago: marca en store, dispara creación de cuenta cliente
  // (solo si aún no tiene acceso) y abre la modal de confirmación.
  const settlePaid = useCallback(
    (status?: EstadoApartado | null) => {
      markPaidLocally();
      setPaidStatus(status ?? null);
      if (!status?.tieneAcceso) onPaid?.();
      setFlow("paid");
      setPaidDialogOpen(true);
    },
    [markPaidLocally, onPaid]
  );

  // Un intento de verificación: si está pagado → éxito; si no, suma intento y,
  // al llegar a MAX_ATTEMPTS, muestra "contacta a tu asesor".
  const runCheck = useCallback(async () => {
    setFlow("checking");
    const actual = await consultarApartado();
    if (actual?.pagado) {
      settlePaid(actual);
      return;
    }
    // Si STP ya reportó algún depósito, el pago está en curso: se sigue
    // consultando sin gastar intentos, para que el cliente vea cómo avanza.
    if ((actual?.movimientos.length ?? 0) > 0) {
      setFlow("waiting");
      setAttempts(0);
      return;
    }
    setAttempts((prev) => {
      const n = prev + 1;
      setFlow(n >= MAX_ATTEMPTS ? "exhausted" : "waiting");
      return n;
    });
  }, [consultarApartado, settlePaid]);

  // Auto-verificación cada minuto mientras esté "waiting" (hasta MAX_ATTEMPTS).
  useEffect(() => {
    if (flow !== "waiting") return;
    const t = setTimeout(runCheck, CHECK_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [flow, attempts, runCheck]);

  // Chequeo silencioso al entrar: si el cliente vuelve al link después de pagar,
  // ve la confirmación de inmediato y no espera el primer minuto. No gasta intentos.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const paid = await checkPaidInDB();
      if (!cancelado && paid) settlePaid(paid);
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fuerza el éxito sin transferencia real (solo pruebas internas). Aun así se
  // consulta el estado real: si el RPC ya responde, la modal usa sus datos.
  const handleDemoPay = async () => {
    // Se toma el estado real (aunque aún no esté pagado) para que la modal use el
    // `tiene_acceso` verdadero y no invente que se creó una cuenta.
    const actual = await consultarApartado();
    settlePaid({
      ...(actual ?? {
        estatusId: null, idCuentaCobranza: null, clabe: null, montoObjetivo: null,
        totalAplicado: 0, restante: null, movimientos: [], conDetalle: false,
      }),
      pagado: true,
      emailEnmascarado: actual?.emailEnmascarado ?? enmascararEmail(clientEmail),
      tieneAcceso: !!actual?.tieneAcceso,
    } as EstadoApartado);
  };

  // Portal del cliente en una pestaña aparte: el cliente conserva esta pantalla con
  // sus datos del apartado mientras entra a la plataforma. Cross-subdominio, así que
  // es window.open y no react-router.
  const goToClientPortal = () => { window.open(CLIENT_PORTAL_LOGIN_URL, "_blank", "noopener"); };

  // Sin CLABE en la propiedad no hay a dónde transferir: pedir al asesor.
  if (!clabe) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-warning/40 bg-warning/[0.05] p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              CLABE de apartado no disponible
            </p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Esta unidad aún no tiene una CLABE STP asignada para el apartado.
              Contacta a tu asesor para generarla antes de continuar con el pago.
            </p>
          </div>
        </div>
        <AdvisorContactCard agent={agent} />
      </div>
    );
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - attempts);

  // Monto objetivo: manda la BD (proyectos.monto_apartado vía RPC) sobre lo que
  // trae la oferta en memoria. Si ya hubo depósitos aplicados, lo que el cliente
  // debe transferir es el faltante, no el total.
  const objetivo = estado?.montoObjetivo ?? montoApartado;
  const movimientos = estado?.movimientos ?? [];
  const hayParcial = !!estado && estado.totalAplicado > 0 && (estado.restante ?? 0) > 0;
  const montoAPagar = hayParcial ? (estado!.restante as number) : objetivo;

  return (
    <div className="space-y-4">
      {/* ── Orden de transferencia (ficha SPEI) ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(0,0,0,0.22)]">
        {/* Encabezado */}
        <div className="flex items-center gap-2.5 px-5 py-3 border-b border-border bg-muted/40">
          <div className="w-8 h-8 rounded-lg bg-primary/12 text-primary grid place-items-center shrink-0">
            <Landmark className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary leading-none">
              Orden de transferencia
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-none truncate">
              SPEI · {BENEFICIARIO}
            </p>
          </div>
        </div>

        {/* CLABE — pieza principal */}
        <div className="px-5 py-5">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              CLABE interbancaria
            </p>
            <CopyButton copied={copiedField === "clabe"} onClick={() => copy("clabe", clabe)} />
          </div>
          <p className="font-mono font-semibold text-foreground tabular-nums tracking-tight text-[1.5rem] leading-none break-all">
            {clabeFormatted}
          </p>
          <p className="text-[11px] text-muted-foreground mt-3">Banco {BANCO}</p>
        </div>

        {/* Monto + concepto — dos celdas balanceadas */}
        <div className="grid grid-cols-2 border-t border-border divide-x divide-border">
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Monto exacto
              </p>
              <CopyButton compact copied={copiedField === "monto"} onClick={() => copy("monto", String(montoAPagar))} />
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
              {formatMXN(montoAPagar)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-2">
              {hayParcial
                ? `MXN · faltante de ${formatMXN(objetivo)}, ya recibimos ${formatMXN(estado!.totalAplicado)}`
                : "MXN · se aplica al precio final"}
            </p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Concepto</p>
              <CopyButton compact copied={copiedField === "concepto"} onClick={() => copy("concepto", concepto)} />
            </div>
            <p className="text-sm font-mono font-semibold text-foreground break-all leading-snug">{concepto}</p>
            <p className="text-[10px] text-muted-foreground mt-2">Referencia de tu pago</p>
          </div>
        </div>
      </div>

      {/* ── Movimientos recibidos (en vivo, desde STP) ── */}
      {movimientos.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/40">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Lo que hemos recibido
            </p>
            {estado?.montoObjetivo != null && (
              <p className="text-[11px] font-semibold tabular-nums text-foreground">
                {formatMXN(estado.totalAplicado)} <span className="text-muted-foreground">de</span>{" "}
                {formatMXN(objetivo)}
              </p>
            )}
          </div>

          <ul className="divide-y divide-border">
            {movimientos.map((m, i) => (
              <li key={m.claveRastreo ?? `mov-${i}`} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                    m.aplicado ? "bg-success/15 text-success" : "bg-amber-100 text-amber-600"
                  }`}
                >
                  {m.aplicado ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-semibold tabular-nums text-foreground">
                      {formatMXN(m.monto)}
                    </p>
                    <p className="text-[10px] text-muted-foreground shrink-0">{m.fecha ?? ""}</p>
                  </div>
                  <p className={`text-[11px] leading-snug ${m.aplicado ? "text-muted-foreground" : "text-amber-700"}`}>
                    {m.aplicado
                      ? "Aplicado a tu apartado"
                      : m.razonRechazo
                        ? `No se aplicó: ${m.razonRechazo}`
                        : "Recibido, aún sin aplicar"}
                  </p>
                  {m.claveRastreo && (
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70 break-all">
                      {m.claveRastreo}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Faltante: el caso del depósito de prueba de $1 antes del monto completo */}
          {hayParcial && (
            <div className="flex items-start gap-2.5 border-t border-border bg-primary/[0.04] px-4 py-3">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-[11px] leading-relaxed text-foreground">
                <span className="font-semibold">Tu depósito llegó y se aplicó.</span> Ya puedes
                hacer el depósito completo: transfiere los{" "}
                <span className="font-semibold tabular-nums">{formatMXN(estado!.restante as number)}</span>{" "}
                restantes a la misma CLABE, con el mismo concepto.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Estado de validación del pago ── */}
      {flow === "paid" ? (
        <div className="rounded-2xl border border-success/50 bg-gradient-to-br from-success/[0.10] to-success/[0.02] p-5 space-y-3.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-success/15 flex items-center justify-center shrink-0 ring-4 ring-success/10">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-foreground leading-tight">Pago confirmado</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Apartado registrado · folio <span className="font-mono">{concepto}</span>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-card/70 border border-border/60">
            <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {paidStatus?.tieneAcceso ? (
                <>
                  Ya tienes una cuenta con{" "}
                  <span className="font-semibold text-foreground">
                    {paidStatus?.emailEnmascarado ?? enmascararEmail(clientEmail) ?? "tu correo"}
                  </span>
                  . Inicia sesión para revisar tu apartado.
                </>
              ) : (
                <>
                  Enviamos a{" "}
                  <span className="font-semibold text-foreground">
                    {paidStatus?.emailEnmascarado ?? enmascararEmail(clientEmail) ?? "tu correo"}
                  </span>{" "}
                  tus datos de acceso para entrar a tu portal de cliente.
                </>
              )}
            </p>
          </div>
          {paidStatus?.clabe && (
            <div className="p-3 rounded-xl bg-card/70 border border-border/60 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                CLABE de tu cuenta
              </p>
              <p className="font-mono text-[13px] font-semibold text-foreground break-all">
                {paidStatus.clabe.match(/.{1,4}/g)?.join(" ") ?? paidStatus.clabe}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Úsala para tus pagos siguientes. La CLABE del apartado ya no aplica.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={goToClientPortal}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            Finalizar e ir a mi portal
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setPaidDialogOpen(true)}
            className="w-full h-9 rounded-xl border border-border bg-card text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            Ver instrucciones de acceso
          </button>
        </div>
      ) : flow === "exhausted" ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-amber-300/50 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/[0.06] p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[13px] font-semibold text-foreground">Aún no vemos reflejado tu pago</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Las transferencias SPEI pueden tardar unos minutos. Si ya transferiste,
                tu asesor puede confirmarlo por ti.
              </p>
            </div>
          </div>
          <AdvisorContactCard agent={agent} />
          <button
            type="button"
            onClick={() => { setAttempts(0); setFlow("waiting"); }}
            className="w-full h-10 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:border-primary/40 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Volver a verificar
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            {flow === "checking" ? (
              <Loader2 className="w-4 h-4 text-primary motion-safe:animate-spin shrink-0" />
            ) : (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary/50 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
            )}
            <p className="text-[13px] font-semibold text-foreground flex-1">
              {flow === "checking" ? "Verificando tu pago…" : "Esperando tu transferencia"}
            </p>
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums bg-muted/60 rounded-full px-2 py-0.5">
              {attempts}/{MAX_ATTEMPTS}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Validamos solo. Una transferencia SPEI suele reflejarse entre 3 y 5 minutos.
            {remaining > 0 && <> Seguimos revisando por {Math.ceil((remaining * CHECK_INTERVAL_MS) / 60_000)} min más.</>}
          </p>

          {/* Sugerencia del depósito de prueba: es lo que hace la gente por su cuenta,
              y así sabe que se lo vamos a confirmar antes de mandar el monto completo. */}
          {movimientos.length === 0 && (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              ¿Prefieres ir sobre seguro? Manda primero un depósito pequeño de prueba
              (por ejemplo $1). En cuanto lo veamos aplicado te avisamos aquí para que
              transfieras el resto.
            </p>
          )}
          <button
            type="button"
            onClick={runCheck}
            disabled={flow === "checking"}
            className="w-full h-10 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${flow === "checking" ? "motion-safe:animate-spin" : ""}`} />
            Ya transferí — verificar ahora
          </button>
        </div>
      )}

      {/* Nota de seguridad */}
      <div className="flex items-start gap-2 px-1">
        <ShieldCheck className="w-3.5 h-3.5 text-success/80 shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
          Transfiere desde una cuenta a tu nombre. El apartado se aplica al precio final
          de la unidad. No se realiza ningún cargo a tarjeta.
        </p>
      </div>

      {/* Botón demo — recorrer el flujo sin transferencia real (solo pruebas) */}
      {SHOW_DEMO_PAY_BUTTON && flow !== "paid" && (
        <button
          type="button"
          onClick={handleDemoPay}
          className="w-full h-8 rounded-lg border border-dashed border-border text-[10px] font-medium text-muted-foreground/70 hover:text-foreground hover:border-primary/40 transition-colors flex items-center justify-center gap-1.5"
        >
          Simular pago
          <span className="text-[8px] uppercase tracking-wider bg-muted rounded px-1 py-0.5">Demo</span>
        </button>
      )}

      {/* Confirmación del apartado + cómo entrar a la plataforma */}
      <ApartadoPagadoDialog
        open={paidDialogOpen}
        onOpenChange={setPaidDialogOpen}
        email={paidStatus?.emailEnmascarado ?? enmascararEmail(clientEmail)}
        tieneAcceso={!!paidStatus?.tieneAcceso}
        concepto={concepto}
        loginUrl={CLIENT_PORTAL_LOGIN_URL}
      />
    </div>
  );
};

const ReservarPage = () => {
  const { formalReservationId } = useParams<{ formalReservationId: string }>();
  const [searchParams] = useSearchParams();
  // Viaja desde el link de la oferta (/oferta/O-XXXXXX/<token>) por las pantallas
  // del flujo. Es la credencial de las RPC públicas de pago.
  const reservationToken = parseReservationToken(searchParams.get(RESERVATION_TOKEN_PARAM));

  const formalReservation = useFormalReservationStore((s) =>
    s.reservations.find((r) => r.id === formalReservationId)
  );

  // El id FR-XXXX vive en el store local del navegador que armó el flujo, así que
  // un link compartido (el asesor captura y le manda la liga al cliente) llegaba
  // a un store vacío y la pantalla se quedaba en "Cargando…" para siempre. La
  // oferta se resuelve desde el token del link, que sí es de la BD.
  const { data: reservacion, isLoading: cargandoReservacion } = useQuery({
    queryKey: ["reservacion-publica", reservationToken],
    queryFn: () => cargarReservacionPublica(supabase, reservationToken),
    enabled: !!reservationToken && !formalReservation,
    staleTime: 60_000,
  });

  // La oferta puede no estar en el store (navegación directa / recarga), por eso
  // se carga desde la BD igual que en la oferta pública. Numérico = id real.
  const offerId =
    formalReservation?.offerId ??
    (reservacion?.id_oferta != null ? String(reservacion.id_oferta) : "");
  const isNumericOffer = !!offerId && !isNaN(parseInt(offerId, 10));
  const { data: dbOfferResult, isLoading: cargandoOferta } = useOfferFromDB(offerId);
  const mockOffer = useOfferById(offerId);
  const offer = isNumericOffer ? (dbOfferResult?.offer ?? null) : (mockOffer ?? null);
  // Monto del apartado del proyecto (RPC get_oferta_financials → proyectos.monto_apartado).
  const montoApartado = apartadoDeOferta(offer);
  const mockAgent = useAgentById(offer?.agentId ?? "");
  const [agentFromDB, setAgentFromDB] = useState<Agent | undefined>(undefined);
  const agentOfferId = offerId || undefined;
  useEffect(() => {
    if (!agentOfferId) return;
    (async () => {
      const { data: oferta } = await supabase
        .from("ofertas").select("email_creador").eq("id", Number(agentOfferId)).single();
      if (!oferta?.email_creador) return;
      const { data: usuario } = await supabase
        .from("usuarios").select("id_persona").eq("email", oferta.email_creador).single();
      if (!usuario?.id_persona) return;
      const { data: persona } = await supabase
        .from("personas").select("nombre_legal, telefono, clave_pais_telefono").eq("id", usuario.id_persona).single();
      if (!persona?.nombre_legal) return;
      const countryCode = (persona.clave_pais_telefono ?? "+52").replace("+", "");
      const rawPhone = (persona.telefono ?? "").replace(/\s/g, "");
      setAgentFromDB({
        id: "", fullName: persona.nombre_legal,
        firstName: persona.nombre_legal.split(" ")[0],
        title: "", photoUrl: "", email: "",
        phone: rawPhone ? `${persona.clave_pais_telefono ?? "+52"} ${persona.telefono ?? ""}` : "",
        whatsapp: rawPhone ? `${countryCode}${rawPhone}` : "",
        isAllied: true,
      });
    })();
  }, [agentOfferId]);
  const agent = dbOfferResult?.agent ?? agentFromDB ?? mockAgent ?? undefined;

  // Al confirmarse el pago: crear cuenta del cliente y disparar el correo con sus
  // credenciales de acceso. Best-effort (no bloquea la UI); el paso autoritativo en
  // prod lo cubre el backend al reflejarse el pago (ver .md de ejecución).
  const clientEmail = offer?.prospectEmail;
  const clientName = offer?.prospectName;
  const createClientAccount = useCallback(() => {
    if (!clientEmail) return;
    (supabase as any).functions
      .invoke("create-client-user", { body: { email: clientEmail, nombre: clientName ?? clientEmail } })
      .catch(() => {});
  }, [clientEmail, clientName]);

  // Ya no se exige el registro local: basta la oferta (del store o de la BD).
  const resolviendo = cargandoReservacion || (!!offerId && cargandoOferta);
  if (!offer && resolviendo) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Cargando…
      </div>
    );
  }

  // Sin oferta que mostrar (token ausente, vencido o de otra reservación) el
  // cliente veía un "Cargando…" eterno. Mejor decirle qué pasó.
  if (!offer || !formalReservationId) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="mb-2 text-xl font-semibold">No pudimos abrir tu apartado</h1>
          <p className="text-sm text-muted-foreground">{LINK_NO_VIGENTE}</p>
        </div>
      </PublicShell>
    );
  }

  const clabeApartado = offer.clabeStp;
  // Concepto/referencia estable y rastreable: unidad + oferta (no el id efímero
  // en memoria). El match SPEI real es por CLABE; esto es referencia legible.
  const concepto = `Apartado ${offer.property.unitNumber}OF${offer.id}`;
  // Con cuenta de cobranza la unidad ya tiene dueño: el apartado ya ocurrió y los
  // pagos siguientes se hacen desde el portal del cliente, no desde esta pantalla.
  const yaTieneCuenta = !!offer.hasCuentaCobranza;

  return (
    <PublicShell
      noFooter
      agent={agent}
      developmentLogoUrl={offer.development?.logoUrl ?? offer.development?.logoUrlInverse}
      developmentName={offer.property.projectName}
    >
      <div className="flex flex-col min-h-[calc(100vh-56px)]">
        {/* Contenido — top-align (sin panel de propiedad; ya se mostró en la oferta) */}
        <div className="flex-1 flex items-start justify-center px-4 py-4">
          <div className="w-full max-w-[420px] space-y-5">
            {yaTieneCuenta ? (
              <>
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Unidad apartada
                  </span>
                  <h1 className="text-[1.7rem] font-bold text-foreground leading-tight tracking-tight">
                    Esta unidad ya tiene dueño
                  </h1>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    Ya se generó la cuenta de cobranza de la unidad {offer.property.unitNumber},
                    así que este apartado no puede volver a pagarse. Tus pagos siguientes se
                    realizan desde tu portal de cliente con la CLABE de tu cuenta.
                  </p>
                </div>
                {clabeApartado && (
                  <div className="rounded-2xl border border-border bg-card px-5 py-4 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      CLABE de tu cuenta de cobranza
                    </p>
                    <p className="font-mono font-semibold text-foreground tabular-nums tracking-tight text-[1.15rem] leading-none break-all">
                      {clabeApartado.match(/.{1,4}/g)?.join(" ") ?? clabeApartado}
                    </p>
                  </div>
                )}
                <AdvisorContactCard agent={agent} />
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Apartar · {formatMXN(montoApartado)} MXN
                  </span>
                  <h1 className="text-[1.7rem] font-bold text-foreground leading-tight tracking-tight">
                    Información para tu pago
                  </h1>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    Realiza una transferencia SPEI con estos datos para apartar tu unidad.
                    El monto se aplica al precio final de la propiedad.
                  </p>
                </div>
                <SpeiPayPanel
                  formalReservationId={formalReservationId}
                  offerId={offerId}
                  montoApartado={montoApartado}
                  clabe={clabeApartado}
                  concepto={concepto}
                  agent={agent}
                  clientEmail={clientEmail}
                  reservationToken={reservationToken}
                  onPaid={createClientAccount}
                />
              </>
            )}
          </div>
        </div>

        <OfferFooter offer={offer} />
      </div>
    </PublicShell>
  );
};

export default ReservarPage;
