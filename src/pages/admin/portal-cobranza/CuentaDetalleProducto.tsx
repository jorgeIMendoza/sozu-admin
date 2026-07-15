// CuentaDetalleProducto — same UI as CuentaDetallePropiedad.
// Exists as a separate file so it can diverge independently in the future.
import { CuentaDetallePropiedad } from './CuentaDetallePropiedad';
import type { CuentaDetalleCtx } from './cuentaDetalleShared';

export function CuentaDetalleProducto({ ctx }: { ctx: CuentaDetalleCtx }) {
  return <CuentaDetallePropiedad ctx={ctx} />;
}
