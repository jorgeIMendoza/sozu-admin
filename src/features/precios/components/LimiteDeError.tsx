import { Component, type ErrorInfo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Límite de error del módulo de Precios.
 *
 * La aplicación no tiene ningún `ErrorBoundary`, así que cualquier excepción en
 * el render de una pantalla desmonta el árbol completo y deja el Admin Panel en
 * blanco: sin menú, sin encabezado y sin ninguna pista de qué pasó. Un módulo
 * no debería poder tirar el panel entero, y menos sin decir por qué.
 *
 * Aquí el fallo queda acotado a Precios y se muestra el mensaje y la traza, que
 * es lo único que permite diagnosticarlo sin abrir la consola del navegador.
 */
interface Props {
  children: ReactNode;
}

interface Estado {
  error: Error | null;
  componente: string | null;
}

export class LimiteDeError extends Component<Props, Estado> {
  state: Estado = { error: null, componente: null };

  static getDerivedStateFromError(error: Error): Partial<Estado> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Se conserva en consola además de pintarse: la traza de componentes ayuda
    // a ubicar el punto exacto y no cabe entera en pantalla.
    console.error("[Precios] error no controlado:", error, info.componentStack);
    this.setState({ componente: info.componentStack ?? null });
  }

  render() {
    const { error, componente } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-destructive">
              El módulo de Precios falló al renderizar
            </p>
            <p className="text-sm text-foreground/80">
              El resto del Admin Panel sigue funcionando. Comparte este mensaje para
              corregirlo.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Error
          </p>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-xs text-foreground">
            {error.name}: {error.message}
          </pre>

          {error.stack && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Traza
              </p>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                {error.stack.split("\n").slice(0, 12).join("\n")}
              </pre>
            </>
          )}

          {componente && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Componentes
              </p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                {componente.split("\n").slice(0, 12).join("\n")}
              </pre>
            </>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => this.setState({ error: null, componente: null })}>
            Reintentar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              // El estado local del módulo es la causa más común de un render
              // imposible; limpiarlo permite volver a entrar sin borrar la
              // sesión ni el resto del panel.
              for (const k of Object.keys(localStorage)) {
                if (k.startsWith("sozu-precios-")) localStorage.removeItem(k);
              }
              window.location.reload();
            }}
          >
            Limpiar estado de Precios y recargar
          </Button>
        </div>
      </div>
    );
  }
}
