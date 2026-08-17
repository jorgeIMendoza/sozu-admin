import { useEffect } from "react";
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
import { useInventarioStore } from "@/features/precios/stores/inventarioStore";
import { pendientesDelBorrador } from "@/features/precios/engine/semilla";
import { useVersionesStore } from "@/features/precios/stores/versionesStore";
import { construirDatosVersion } from "@/features/precios/lib/versiones";
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
  const asegurarMotor = useMotorStore((s) => s.asegurarMotor);

  // Universo del selector: los proyectos comercializados por SOZU, no un
  // catálogo propio del módulo. Un desarrollo que SOZU no comercializa no se
  // precia aquí.
  const proyectos = useInventarioStore((s) => s.proyectos);
  const cargarProyectos = useInventarioStore((s) => s.cargarProyectos);
  const cargarInventario = useInventarioStore((s) => s.cargarInventario);
  const porProyecto = useInventarioStore((s) => s.porProyecto);
  const errorInventario = useInventarioStore((s) => s.error);

  useEffect(() => {
    void cargarProyectos();
  }, [cargarProyectos]);

  // El proyecto activo se elige al conocer la lista: ya no viene cableado.
  // También se corrige si el guardado apunta a un proyecto que SOZU dejó de
  // comercializar, para no quedarse en una selección que no existe.
  useEffect(() => {
    if (proyectos.length === 0) return;
    if (!proyectos.some((p) => p.id_proyecto === idProyectoActivo)) {
      setProyectoActivo(proyectos[0]!.id_proyecto);
    }
  }, [proyectos, idProyectoActivo, setProyectoActivo]);

  useEffect(() => {
    if (idProyectoActivo) void cargarInventario(idProyectoActivo);
  }, [idProyectoActivo, cargarInventario]);

  // Con el inventario en memoria se siembra el motor del proyecto. Es
  // idempotente: solo actúa la primera vez que se abre cada desarrollo.
  useEffect(() => {
    if (!idProyectoActivo || !porProyecto[idProyectoActivo]) return;
    const nombre =
      proyectos.find((p) => p.id_proyecto === idProyectoActivo)?.nombre ?? idProyectoActivo;
    asegurarMotor(idProyectoActivo, nombre);
  }, [idProyectoActivo, porProyecto, proyectos, asegurarMotor]);

  const versionesPorProyecto = useVersionesStore((s) => s.versionesPorProyecto);
  const crearBorrador = useVersionesStore((s) => s.crearBorrador);
  const versiones = versionesPorProyecto[idProyectoActivo] ?? SIN_VERSIONES;
  const publicadas = versiones.filter((v) => v.estado === "publicada");
  const publicada =
    publicadas.length > 0
      ? publicadas.reduce((a, b) => (b.numero > a.numero ? b : a))
      : null;
  const { desgloses, propiedades, motor, motorListo, cargando, cargado } =
    usePreciosProyecto();
  const pendientes = motorListo ? pendientesDelBorrador(motor) : [];

  /*
   * La lista arranca en BORRADOR.
   *
   * En cuanto el proyecto tiene inventario real y motor sembrado se registra
   * una primera versión en estado `borrador`: así el módulo nunca queda sin
   * lista, y la que hay deja explícito que todavía no está publicada. Es
   * idempotente —solo corre si el proyecto no tiene ninguna versión— para no
   * generar un borrador nuevo cada vez que se entra a la pantalla.
   */
  useEffect(() => {
    if (!motorListo || !cargado || versiones.length > 0) return;
    if (desgloses.length === 0) return;

    const porId = new Map(desgloses.map((d) => [d.id_propiedad, d]));
    const entradas = propiedades
      .map((p) => ({ propiedad: p, desglose: porId.get(p.id_propiedad)! }))
      .filter((e) => e.desglose);
    if (entradas.length === 0) return;

    crearBorrador({
      ...construirDatosVersion({
        idProyecto: idProyectoActivo,
        nombre: "",
        motor,
        entradas,
        notas:
          "Borrador inicial derivado del inventario real del proyecto. " +
          "El precio base por m² de cada modelo es su precio por m² ponderado " +
          "actual; las curvas de nivel y tamaño están planas hasta calibrar.",
      }),
      nombre: "Borrador inicial · inventario real",
    });
  }, [
    motorListo,
    cargado,
    versiones.length,
    desgloses,
    propiedades,
    motor,
    idProyectoActivo,
    crearBorrador,
  ]);

  // Cuatro estados: cargando, borrador (nunca publicada), publicada al
  // corriente, o con cambios sin publicar.
  const estadoChip = (() => {
    if (cargando || !cargado) {
      return {
        texto: "Cargando inventario…",
        tono: "ambar" as const,
        detalle: "Se está leyendo el inventario real del proyecto.",
      };
    }
    if (!publicada) {
      return {
        texto: "Lista en borrador",
        tono: "ambar" as const,
        detalle:
          pendientes.length > 0
            ? `Derivada del inventario real y aún sin publicar. Falta: ${pendientes.join(" ")}`
            : "Derivada del inventario real y aún sin publicar.",
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
            <Select
              value={idProyectoActivo || undefined}
              onValueChange={setProyectoActivo}
              disabled={proyectos.length === 0}
            >
              <SelectTrigger className="w-52">
                <SelectValue
                  placeholder={
                    proyectos.length === 0 ? "Cargando proyectos…" : "Proyecto"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {proyectos.map((p) => (
                  <SelectItem key={p.id_proyecto} value={p.id_proyecto}>
                    {p.nombre}
                    {p.num_departamentos > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {p.num_departamentos} u.
                      </span>
                    )}
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

        {errorInventario && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorInventario}
          </div>
        )}

        {cargado && proyectos.length > 0 && desgloses.length === 0 && !cargando && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            Este proyecto no tiene unidades activas capturadas en Inventarios, así que no hay
            nada que preciar todavía.
          </div>
        )}

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
