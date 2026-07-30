import { Loader2, AlertTriangle, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Estados compartidos de carga/error para los menús del portal de cobranza.
// Centrados en X/Y dentro del alto del <main> (responsive, sin overflow).
// Fuente única: si cambia el diseño, se cambia aquí y aplica a todos los menús.

const WRAP = 'flex flex-col items-center justify-center gap-3 text-center min-h-[calc(100vh-160px)]';

export function CollectionLoading({ label = 'Cargando...' }: { label?: string }) {
  return (
    <div className={WRAP}>
      <Loader2 className="w-8 h-8 animate-spin text-success" />
      <span className="text-base font-semibold text-foreground">{label}</span>
    </div>
  );
}

export function CollectionError({
  title = 'No pudimos cargar la información',
  onRetry,
}: {
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <div className={WRAP}>
      <div className="flex size-14 items-center justify-center rounded-full bg-danger/10">
        <AlertTriangle className="size-7 text-danger" />
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
          Hubo un problema al obtener la información. Revisa tu conexión e inténtalo de nuevo.
        </p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="h-9 text-[13px] mt-1 hover:border-success hover:text-success hover:bg-success/5"
        >
          Reintentar
        </Button>
      )}
    </div>
  );
}

/**
 * Las RPC del portal validan permisos por dentro y responden 403 (ERRCODE 42501).
 * Cuando eso pasa se muestra esto, no una tabla vacía ni un error de carga: la diferencia
 * entre "no tienes acceso" y "falló la consulta" importa para no mandar a la gente a
 * reintentar algo que nunca va a funcionar.
 */
export function CollectionSinPermiso({
  title = 'No tienes permiso para ver esta información',
}: { title?: string }) {
  return (
    <div className={WRAP}>
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <ShieldOff className="size-7 text-muted-foreground" />
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
          Tu rol no tiene acceso de lectura a este módulo. Si lo necesitas, pídelo al
          administrador del sistema.
        </p>
      </div>
    </div>
  );
}
