import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ArrowRight, CheckCircle2, ExternalLink, KeyRound, Mail, Smartphone } from "lucide-react";
import { cargarLinksApp, type AppClienteLinks } from "@/lib/offers/apartado-status";

/** Webmail del dominio del correo, para el botón "Abrir mi correo". */
const WEBMAIL_POR_DOMINIO: Record<string, { url: string; nombre: string }> = {
  "gmail.com": { url: "https://mail.google.com", nombre: "Gmail" },
  "googlemail.com": { url: "https://mail.google.com", nombre: "Gmail" },
  "outlook.com": { url: "https://outlook.live.com/mail", nombre: "Outlook" },
  "hotmail.com": { url: "https://outlook.live.com/mail", nombre: "Outlook" },
  "live.com": { url: "https://outlook.live.com/mail", nombre: "Outlook" },
  "msn.com": { url: "https://outlook.live.com/mail", nombre: "Outlook" },
  "yahoo.com": { url: "https://mail.yahoo.com", nombre: "Yahoo Mail" },
  "yahoo.com.mx": { url: "https://mail.yahoo.com", nombre: "Yahoo Mail" },
  "icloud.com": { url: "https://www.icloud.com/mail", nombre: "iCloud Mail" },
  "me.com": { url: "https://www.icloud.com/mail", nombre: "iCloud Mail" },
};

/** Toma el dominio de un correo, ya venga completo o enmascarado (j***@gmail.com). */
const webmailDe = (email?: string | null) => {
  const dominio = (email ?? "").split("@")[1]?.trim().toLowerCase();
  return dominio ? WEBMAIL_POR_DOMINIO[dominio] ?? null : null;
};

export interface ApartadoPagadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Correo del cliente, enmascarado por el RPC (j***@gmail.com). */
  email?: string | null;
  /** true → ya tenía usuario en la plataforma; no se le mandan credenciales nuevas. */
  tieneAcceso: boolean;
  /** Folio/concepto del apartado, para que el cliente lo tenga a la mano. */
  concepto?: string;
  /** Login del portal de cliente (cross-subdominio). */
  loginUrl: string;
}

/**
 * Confirmación del apartado pagado. Dos variantes según el cliente ya tenga o no
 * acceso a la plataforma: con cuenta recién creada se le manda a revisar su correo;
 * con cuenta existente, directo al login.
 */
export function ApartadoPagadoDialog({
  open,
  onOpenChange,
  email,
  tieneAcceso,
  concepto,
  loginUrl,
}: ApartadoPagadoDialogProps) {
  const webmail = webmailDe(email);

  // Links de tienda desde `app_cliente_config`. Si la tabla no es legible sin sesión
  // o la llave viene vacía (hoy iOS lo está), ese botón simplemente no se pinta.
  const [app, setApp] = useState<AppClienteLinks>({ android: null, ios: null, version: null });
  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    cargarLinksApp().then((links) => { if (!cancelado) setApp(links); });
    return () => { cancelado = true; };
  }, [open]);

  // El botón de tienda solo tiene sentido en el celular.
  const esMovil =
    typeof navigator !== "undefined" && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  const etiquetaTiendas = [app.android && "Android", app.ios && "iPhone"]
    .filter(Boolean)
    .join(" y ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] gap-0 overflow-hidden p-0">
        <div className="px-6 pt-6 pb-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-success/15 ring-4 ring-success/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold text-foreground leading-tight">
                ¡Pago confirmado!
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Tu unidad quedó apartada
                {concepto && <> · folio <span className="font-mono">{concepto}</span></>}
              </p>
            </div>
          </div>

          {tieneAcceso ? (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Ya tienes una cuenta con{" "}
                <span className="font-semibold text-foreground">{email ?? "tu correo"}</span>.
                Inicia sesión en tu portal de cliente para revisar tu apartado, tu plan de
                pagos y tu expediente.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Creamos tu cuenta. Enviamos a{" "}
                <span className="font-semibold text-foreground">{email ?? "tu correo"}</span>{" "}
                la información para acceder. Revisa tu bandeja (y la carpeta de spam) e
                inicia sesión para continuar con tu proceso.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {!tieneAcceso && webmail && (
              <a
                href={webmail.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                Abrir {webmail.nombre}
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <a
              href={loginUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                !tieneAcceso && webmail
                  ? "border border-border bg-card text-foreground hover:border-primary/40"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99]"
              }`}
            >
              {tieneAcceso ? "Iniciar sesión" : "Ir a iniciar sesión"}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* App del portal de clientes. En el celular se ofrece la descarga; en
              escritorio solo se menciona, porque ahí el link de tienda no sirve. */}
          {(app.android || app.ios) && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  {esMovil
                    ? "También puedes seguir tu proceso desde la app de clientes."
                    : `Tu portal también existe como app${etiquetaTiendas ? ` para ${etiquetaTiendas}` : ""}. Búscala desde tu celular.`}
                </p>
              </div>
              {esMovil && (
                <div className="grid grid-cols-1 gap-2">
                  {app.android && (
                    <a
                      href={app.android}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-10 rounded-lg border border-border bg-card text-xs font-semibold text-foreground flex items-center justify-center gap-2 hover:border-primary/40 transition-colors"
                    >
                      Descargar para Android
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {app.ios && (
                    <a
                      href={app.ios}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-10 rounded-lg border border-border bg-card text-xs font-semibold text-foreground flex items-center justify-center gap-2 hover:border-primary/40 transition-colors"
                    >
                      Descargar para iPhone
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ApartadoPagadoDialog;
