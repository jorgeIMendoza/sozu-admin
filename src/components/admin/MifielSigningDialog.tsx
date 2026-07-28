import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { ModalFormHeader } from "@/components/ui/modal-form";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";

interface MifielSigningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgetId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const TITULO = "Firma digital";
const SUBTITULO = "Revisa tu carta y fírmala de forma electrónica";

export function MifielSigningDialog({ open, onOpenChange, widgetId, onSuccess, onError }: MifielSigningDialogProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);
  const signedRef = useRef(false);
  // 'cargando' hasta que el widget se monta; 'error' si el script no baja.
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");

  // Callbacks por ref: en el padre son funciones inline (identidad nueva en cada
  // render). Si entraran en las deps del efecto, el widget se desmontaría y volvería
  // a montarse a media firma.
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  useEffect(() => {
    if (!open || !widgetId) return;
    let cancelado = false;
    signedRef.current = false;
    setEstado("cargando");

    const loadWidget = () => {
      if (cancelado || !containerRef.current) return;
      containerRef.current.innerHTML = "";

      const widget = document.createElement("mifiel-widget") as any;
      widget.setAttribute("id", widgetId);
      const env = import.meta.env.VITE_ENVIRONMENT || "development";
      widget.setAttribute("environment", env === "production" ? "production" : "sandbox");
      containerRef.current.appendChild(widget);
      setEstado("listo");

      widget.addEventListener("signSuccess", () => {
        signedRef.current = true;
        if (containerRef.current) containerRef.current.innerHTML = "";
        onOpenChange(false);
        onSuccessRef.current?.();
      });
      widget.addEventListener("signError", (e: any) => {
        // Delay error handling to allow signSuccess to fire first (widget race condition)
        setTimeout(() => {
          if (signedRef.current) return;
          signedRef.current = true;
          if (containerRef.current) containerRef.current.innerHTML = "";
          onOpenChange(false);
          const msg = e?.detail?.message || "";
          if (msg && !msg.includes("already") && !msg.includes("Ya fue firmado")) {
            onErrorRef.current?.(msg);
          }
        }, 500);
      });
    };

    const mifielEnv = import.meta.env.VITE_ENVIRONMENT || "development";
    const mifielHost = mifielEnv === "production" ? "app.mifiel.com" : "app-sandbox.mifiel.com";
    const scriptSrc = `https://${mifielHost}/widget-component/index.js`;

    // Esperar a que el custom element quede registrado, en vez de adivinar con un
    // setTimeout: era la causa de que el primer intento fallara y el segundo sí.
    const montarCuandoEsteListo = () => {
      if (cancelado) return;
      if (!window.customElements) {
        setEstado("error");
        return;
      }
      // Con tope: si el elemento nunca se registra, no dejamos el spinner eterno.
      const vencido = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout mifiel-widget")), 15000)
      );
      Promise.race([window.customElements.whenDefined("mifiel-widget"), vencido])
        .then(() => loadWidget())
        .catch((e) => {
          console.error("[mifiel-widget]", e);
          if (!cancelado) setEstado("error");
        });
    };

    if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
      const script = document.createElement("script");
      script.src = scriptSrc;
      script.type = "module";
      script.onload = () => {
        scriptLoadedRef.current = true;
        montarCuandoEsteListo();
      };
      script.onerror = () => {
        console.error("Failed to load Mifiel widget script from:", scriptSrc);
        if (!cancelado) setEstado("error");
      };
      document.head.appendChild(script);
    } else {
      scriptLoadedRef.current = true;
      montarCuandoEsteListo();
    }

    return () => {
      cancelado = true;
    };
  }, [open, widgetId, onOpenChange]);

  const content = (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5">
      {/* Nota legal: mismo tono que el resto del portal, sin emoji. */}
      <div className="flex items-start gap-2.5 rounded-md border border-primary/20 bg-primary/[0.06] px-3 py-2.5">
        <ShieldCheck className="mt-px size-4 shrink-0 text-primary" />
        <p className="text-xs font-medium leading-relaxed text-primary">
          La firma digital robustece la validez legal del documento. Al terminar, tu carta queda
          registrada en tu expediente.
        </p>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto rounded-md border border-border bg-card">
        {estado !== "listo" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card px-6 text-center">
            {estado === "cargando" ? (
              <>
                <Loader2 className="size-7 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Cargando tu carta…</p>
              </>
            ) : (
              <>
                <AlertCircle className="size-7 text-destructive" />
                <p className="text-sm font-semibold text-foreground">No se pudo cargar la firma</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Revisa tu conexión y vuelve a intentarlo. Si el problema sigue, contacta a tu
                  administrador.
                </p>
              </>
            )}
          </div>
        )}
        <div ref={containerRef} className="mifiel-fullwidth flex min-h-full items-start justify-center p-2 sm:p-3" />
      </div>

      <style>{`
        .mifiel-fullwidth mifiel-widget {
          --mifiel-widget-max-width: 100% !important;
          width: 100% !important;
          zoom: 1 !important;
        }

        .mifiel-fullwidth mifiel-widget,
        .mifiel-fullwidth mifiel-widget > div,
        .mifiel-fullwidth mifiel-widget > div > div {
          max-width: 100% !important;
          width: 100% !important;
          transform: none !important;
        }
      `}</style>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex h-[96vh] max-h-[96vh] flex-col overflow-hidden rounded-t-2xl">
          <DrawerHeader className="shrink-0 border-b border-border px-4 pb-3 pt-2 text-left">
            <DrawerTitle className="text-base font-bold text-foreground">{TITULO}</DrawerTitle>
            <DrawerDescription className="mt-0.5 text-xs text-muted-foreground">{SUBTITULO}</DrawerDescription>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Ancho contenido (antes 95vw): el widget se lee mejor en una columna
          acotada y el modal deja de tapar toda la pantalla. */}
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[calc(100vw-2rem)] max-w-[900px] flex-col gap-0 overflow-hidden rounded-md border border-border bg-card p-0 shadow-lg">
        <ModalFormHeader title={TITULO} subtitle={SUBTITULO} />
        {content}
      </DialogContent>
    </Dialog>
  );
}
