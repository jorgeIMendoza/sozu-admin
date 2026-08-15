import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMotorStore } from "@/features/precios/stores/motorStore";
import type { VersionLista } from "@/features/precios/types/dominio";
import { PROYECTOS } from "@/features/precios/mocks/inventario";
import { useVersionesStore } from "@/features/precios/stores/versionesStore";
import { formatoFechaCorta, formatoMoneda } from "@/features/precios/lib/formato";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePreciosProyecto } from "@/features/precios/hooks/usePreciosProyecto";

const PESTANAS = [
  { titulo: "Tabla de Precios", ruta: "/admin/inventario/precios/tabla" },
  { titulo: "Configuración del Motor", ruta: "/admin/inventario/precios/motor" },
  { titulo: "Calibración", ruta: "/admin/inventario/precios/calibracion" },
  { titulo: "Escenarios", ruta: "/admin/inventario/precios/escenarios" },
  { titulo: "Auditoría", ruta: "/admin/inventario/precios/auditoria" },
];

/** Referencia estable: un arreglo nuevo por render rompe useSyncExternalStore. */
const SIN_VERSIONES: VersionLista[] = [];

function PreciosLayout() {
  const pathname = useLocation().pathname;
  const idProyectoActivo = useMotorStore((s) => s.idProyectoActivo);
  const setProyectoActivo = useMotorStore((s) => s.setProyectoActivo);
  const versionesPorProyecto = useVersionesStore((s) => s.versionesPorProyecto);
  const versiones = versionesPorProyecto[idProyectoActivo] ?? SIN_VERSIONES;
  const publicadas = versiones.filter((v) => v.estado === "publicada");
  const publicada =
    publicadas.length > 0
      ? publicadas.reduce((a, b) => (b.numero > a.numero ? b : a))
      : null;
  const { desgloses } = usePreciosProyecto();

  // Tres estados: sin versión, publicada al corriente, o con cambios sin publicar.
  const estadoChip = (() => {
    if (!publicada) {
      return {
        texto: "Sin versión publicada",
        tono: "ambar" as const,
        detalle: "Los precios que ves son un borrador de trabajo.",
      };
    }
    let sinPublicar = 0;
    let impacto = 0;
    for (const d of desgloses) {
      const congelado = publicada.precios[d.id_propiedad];
      if (!congelado) {
        sinPublicar += 1;
        impacto += d.precio_lista;
        continue;
      }
      if (Math.abs(congelado.precio_lista - d.precio_lista) > 0.01) {
        sinPublicar += 1;
        impacto += d.precio_lista - congelado.precio_lista;
      }
    }
    if (sinPublicar === 0) {
      return {
        texto: `Lista v${publicada.numero} · Publicada`,
        tono: "verde" as const,
        detalle: `Publicada el ${formatoFechaCorta(publicada.publicada_en ?? publicada.creada_en)}. Sin cambios posteriores.`,
      };
    }
    return {
      texto: `Lista v${publicada.numero} · ${sinPublicar} unidades sin publicar`,
      tono: "ambar" as const,
      detalle: `Impacto contra la lista publicada: ${formatoMoneda(impacto)}.`,
    };
  })();

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Precios</h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              Motor de precios, calibración y estrategia comercial
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={idProyectoActivo} onValueChange={setProyectoActivo}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Proyecto" />
              </SelectTrigger>
              <SelectContent>
                {PROYECTOS.map((p) => (
                  <SelectItem key={p.id_proyecto} value={p.id_proyecto}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/admin/inventario/precios/auditoria/versiones"
                  className={cn(
                    "rounded-full px-3 py-1 text-xs tabular-nums transition-colors",
                    estadoChip.tono === "verde"
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100",
                  )}
                >
                  {estadoChip.texto}
                </Link>
              </TooltipTrigger>
              {estadoChip.detalle && (
                <TooltipContent>{estadoChip.detalle}</TooltipContent>
              )}
            </Tooltip>

          </div>
        </div>

        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {PESTANAS.map((p) => {
            const activo = pathname.startsWith(p.ruta);
            return (
              <Link
                key={p.ruta}
                to={p.ruta}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  activo
                    ? "border border-border bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.titulo}
              </Link>
            );
          })}
        </div>

        <Outlet />
      </div>
    </>
  );
}

export default PreciosLayout;
