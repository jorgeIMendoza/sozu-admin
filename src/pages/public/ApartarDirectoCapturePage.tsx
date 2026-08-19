import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useOfferFromDB } from "@/lib/offers/use-offer-db";
import { useOfferById, useOfferStore } from "@/lib/offers/offer-data";
import { useFormalReservationStore } from "@/lib/offers/formal-reservation-data";
import type { Agent } from "@/lib/offers/agent-data";
import { supabase } from "@/integrations/supabase/client";
import ProspectCaptureForm from "@/components/capture/ProspectCaptureForm";
import PublicShell from "@/components/offer/PublicShell";
import OfferFooter from "@/components/offer/OfferFooter";
import { CsfUploadCard, type CsfCampos } from "@/components/offer/CsfUploadCard";
import { getPortalLoginUrl } from "@/lib/portalUrls";
import {
  RESERVATION_TOKEN_PARAM,
  parseReservationToken,
  withReservationToken,
} from "@/lib/offers/reservation-token";
import { CheckCircle2, ExternalLink, Loader2, LogIn, Mail, MousePointerClick } from "lucide-react";
import { toast } from "sonner";

/** Login del portal de clientes, para quien ya tiene cuenta. */
const PORTAL_CLIENTE_URL = getPortalLoginUrl("clientes");

/**
 * Paso previo al pago del apartado: el cliente confirma sus datos y sube su
 * Constancia de Situación Fiscal, que es requisito para poder pagar (el SPEI se
 * valida contra el RFC/CURP del ordenante). De aquí pasa a la pantalla de pago.
 *
 * Si ya es cliente de SOZU (usuario activo + al menos una propiedad) no se le
 * vuelve a pedir nada: se le manda a iniciar sesión en su portal.
 */
const ApartarDirectoCapturePage = () => {
  const { offerToken } = useParams<{ offerToken: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Credencial del link personal del cliente: sin ella las RPC públicas no responden.
  const reservationToken = parseReservationToken(searchParams.get(RESERVATION_TOKEN_PARAM));

  const isNumericToken = !!offerToken && !isNaN(parseInt(offerToken, 10));
  const ofertaDelStore = useOfferById(offerToken ?? "");
  const { data: dbOfferResult, isLoading: dbLoading } = useOfferFromDB(offerToken ?? "");
  const offer = isNumericToken ? (dbOfferResult?.offer ?? null) : (ofertaDelStore ?? null);
  const [agentFromDB, setAgentFromDB] = useState<Agent | undefined>(undefined);
  const [csfLista, setCsfLista] = useState(false);

  // Store local del flujo: prospecto + reserva que consume la pantalla de pago.
  const prospectos = useOfferStore((st) => st.prospects);
  const createProspect = useOfferStore((st) => st.createProspect);
  const verifyProspect = useOfferStore((st) => st.verifyProspect);
  const setActiveProspect = useOfferStore((st) => st.setActiveProspect);
  const reservations = useFormalReservationStore((st) => st.reservations);
  const initiateFormalReservation = useFormalReservationStore((st) => st.initiateFormalReservation);

  // ¿El lead ya es cliente de SOZU (usuario activo + al menos una propiedad)?
  // En ese caso no se le vuelve a dar de alta: va directo a iniciar sesión.
  const { data: estadoCliente, isLoading: cargandoEstado } = useQuery({
    queryKey: ["oferta-estado-cliente", reservationToken],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_cliente_estado_oferta", {
        p_token: reservationToken,
      });
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as {
        tiene_acceso: boolean;
        tiene_propiedades: boolean;
        es_cliente_existente: boolean;
        email_enmascarado: string | null;
      } | null;
    },
    enabled: !!reservationToken,
  });

  const esClienteExistente = !!estadoCliente?.es_cliente_existente;

  const agentOfferId = offer?.id;
  const agenteDelRpc = dbOfferResult?.agent;
  useEffect(() => {
    // `get_oferta_financials` ya resuelve al asesor con permiso para `anon`. La cascada de
    // abajo solo cubre las ofertas que el RPC no alcanza: como anónimo, `usuarios` solo
    // expone al rol Cliente (23), así que pedirla para un asesor interno devuelve 406.
    if (!agentOfferId || agenteDelRpc) return;
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
  }, [agentOfferId, agenteDelRpc]);
  const agent = agenteDelRpc ?? agentFromDB;

  if (isNumericToken && dbLoading) return null;

  if (!offer) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="mb-2 text-xl font-semibold">Oferta no encontrada</h1>
          <p className="text-sm text-muted-foreground">
            El link puede haber expirado. Contacta a tu asesor para recibir uno nuevo.
          </p>
        </div>
      </PublicShell>
    );
  }

  // Guarda nombre/teléfono corregidos. Solo se llama si el cliente los editó.
  const handleSaveData = async (data: { fullName: string; phoneDigits: string; countryCode: string }) => {
    try {
      const { data: ok, error } = await (supabase as any).rpc("update_lead_datos", {
        p_oferta_id: Number(offer.id),
        p_nombre: data.fullName,
        p_telefono: data.phoneDigits,
        // Sin token la RPC devuelve false y no escribe nada (fallo cerrado).
        p_token: reservationToken,
      });
      return !error && ok !== false;
    } catch {
      return false;
    }
  };

  // Constancia: el archivo va al bucket `documentos` y el registro + los datos
  // fiscales los escribe la RPC (anon no puede tocar `documentos` ni `personas`).
  const handleGuardarCsf = async (file: File, campos: CsfCampos) => {
    if (!reservationToken) return false;
    const marcarLista = (ok: boolean) => { if (ok) setCsfLista(true); return ok; };
    try {
      // `anon` no sube directo a Storage. Hacerlo exigiria darle SELECT sobre
      // storage.objects (el INSERT de storage-api lleva RETURNING), y con el bucket
      // `documentos` publico esa politica habilita /object/list: cualquiera podria
      // enumerar y bajar las constancias de todos los clientes.
      //
      // En su lugar la EF valida el token de la reservacion con service_role y
      // devuelve una subida firmada a una ruta que decide el servidor:
      // documentos/personas/<id_persona>/6_<ts>.<ext> — la misma convencion que usa
      // el Panel Admin al subir un documento desde el perfil de la persona.
      const { data: firma, error: firmaErr } = await supabase.functions.invoke("oferta-csf-subir", {
        body: { token: reservationToken, filename: file.name },
      });
      if (firmaErr || !firma?.uploadToken) {
        // supabase-js no expone el cuerpo del error de una EF: sin leer el
        // `context` no se distingue un token vencido (403) de una oferta sin
        // lead (409), y en consola solo aparece "non-2xx status code".
        const detalle = await (firmaErr as any)?.context?.json?.().catch(() => null);
        console.error("oferta-csf-subir falló:", detalle ?? firmaErr ?? "sin uploadToken");
        throw firmaErr ?? new Error("No se pudo preparar la subida de la constancia");
      }

      const { error: upErr } = await supabase.storage
        .from("documentos")
        .uploadToSignedUrl(firma.path, firma.uploadToken, file, {
          contentType: file.type || "application/pdf",
        });
      if (upErr) throw upErr;

      const { data: ok, error } = await (supabase as any).rpc("guardar_csf_oferta", {
        p_token: reservationToken,
        p_url: firma.publicUrl,
        p_rfc: campos.rfc || null,
        p_curp: campos.curp || null,
        p_nombre: campos.nombre || null,
        p_regimen: campos.regimen || null,
        p_cp: campos.cp || null,
        p_calle: campos.calle || null,
        p_num_ext: campos.numExt || null,
        p_num_int: campos.numInt || null,
        p_colonia: campos.colonia || null,
      });
      return marcarLista(!error && ok !== false);
    } catch (e: any) {
      // El detalle importa: storage devuelve 400 tanto por RLS como por llave
      // inválida, y sin el mensaje no hay forma de distinguirlos en soporte.
      console.error("Error guardando la constancia:", e?.message ?? e, e);
      return false;
    }
  };

  // Con los datos confirmados y la Constancia cargada, pasa a la pantalla de pago.
  const handleComplete = (data: { fullName: string; email: string; phone: string }) => {
    if (!csfLista) {
      toast.error("Sube tu Constancia de Situación Fiscal para continuar con el pago.");
      return;
    }
    const existing = prospectos.find((p) => p.email?.toLowerCase() === data.email.toLowerCase());
    const prospectId = existing?.id ?? createProspect({
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      source: "formal_direct",
    }).id;
    verifyProspect(prospectId);
    setActiveProspect(prospectId);

    const reserva = reservations.find((r) => r.prospectId === prospectId && r.offerId === offer.id);
    const formalReservationId = reserva?.id ?? initiateFormalReservation({
      preReservationId: null,
      prospectId,
      offerId: offer.id,
      agentId: offer.agentId ?? "AGT-RAMON",
      appliedAmountMXN: 0,
    }).id;

    navigate(withReservationToken(`/reservar/${formalReservationId}/wizard`, reservationToken));
  };

  return (
    <PublicShell
      noFooter
      agent={agent}
      developmentLogoUrl={offer.development?.logoUrl ?? offer.development?.logoUrlInverse}
      developmentName={offer.property.projectName}
    >
      <div className="flex flex-col min-h-[calc(100vh-56px)]">
        <div className="flex-1 flex items-start justify-center px-4 py-4">
          <div className="w-full max-w-[420px]">
            {cargandoEstado ? (
              <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Un momento…
              </div>
            ) : esClienteExistente ? (
              /* Ya es cliente de SOZU: no se le vuelve a dar de alta. */
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/[0.06]">
                    <LogIn className="h-5 w-5 text-primary" />
                  </div>
                  <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight text-foreground">
                    Ya tienes cuenta en SOZU
                  </h1>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    Tu correo{" "}
                    <span className="font-semibold text-foreground">
                      {estadoCliente?.email_enmascarado ?? "registrado"}
                    </span>{" "}
                    ya está dado de alta y tienes propiedades con nosotros. No necesitas
                    volver a registrarte: entra a tu portal y continúa con tu pago desde ahí.
                  </p>
                </div>

                <a
                  href={PORTAL_CLIENTE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.99]"
                >
                  Iniciar sesión en mi portal <ExternalLink className="h-4 w-4" />
                </a>

                <p className="text-center text-[11px] leading-relaxed text-muted-foreground/70">
                  Se abre en una pestaña nueva; esta oferta se queda aquí.
                  <br />
                  ¿No recuerdas tu contraseña? Recupérala desde la pantalla de acceso.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <ProspectCaptureForm
                  offer={offer}
                  context="formal_direct"
                  defaultEmail={offer.prospectEmail}
                  defaultFullName={offer.prospectName}
                  defaultPhone={offer.prospectPhone}
                  defaultDialCode={offer.prospectDialCode}
                  onSaveData={handleSaveData}
                  onComplete={handleComplete}
                  submitLabel="Continuar con el pago"
                  extraFields={
                    <CsfUploadCard
                      required
                      onGuardar={handleGuardarCsf}
                      hint="La necesitamos para validar tu pago: el SPEI se verifica contra el RFC o CURP de quien transfiere."
                    />
                  }
                />
              </div>
            )}
          </div>
        </div>

        <OfferFooter offer={offer} />
      </div>
    </PublicShell>
  );
};

export default ApartarDirectoCapturePage;
