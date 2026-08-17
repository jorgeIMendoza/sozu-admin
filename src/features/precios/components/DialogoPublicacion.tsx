import { useEffect, useMemo, useState } from "react";
import { CircleX, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePreciosProyecto } from "../hooks/usePreciosProyecto";
import { useListaStore } from "../stores/listaStore";
import { useOfertasStore } from "../stores/ofertasStore";
import { useVersionesStore } from "../stores/versionesStore";
import {
  construirDatosVersion,
  encontrarBorradorReutilizable,
  evaluarPublicacion,
} from "../lib/versiones";
import { registrarEvento } from "../services/auditoria";
import { formatoFechaCorta, formatoMoneda } from "../lib/formato";
import { useProyectosPrecios } from "../hooks/useInventarioActivo";

/** Mínimo de caracteres exigido a las notas de publicación. */
const MIN_NOTAS = 20;

export function DialogoPublicacion({
  abierto,
  onOpenChange,
}: {
  abierto: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { motor, propiedades, desgloses, alertasPorUnidad, totales } =
    usePreciosProyecto();
  const overrides = useListaStore((s) => s.overrides);
  const ofertas = useOfertasStore((s) => s.ofertas);
  const crearBorrador = useVersionesStore((s) => s.crearBorrador);
  const publicar = useVersionesStore((s) => s.publicar);
  const versiones = useVersionesStore((s) => s.versionesPorProyecto);

  const [nombre, setNombre] = useState("");
  const [notas, setNotas] = useState("");
  const [confirmadas, setConfirmadas] = useState<string[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [avisado, setAvisado] = useState(false);

  const proyectos = useProyectosPrecios();
  const idProyecto = motor.id_proyecto;
  const nombreProyecto =
    proyectos.find((p) => p.id_proyecto === idProyecto)?.nombre ?? idProyecto;

  const listaProyecto = versiones[idProyecto] ?? [];
  const publicada = useMemo(() => {
    const pubs = listaProyecto.filter((v) => v.estado === "publicada");
    return pubs.length > 0 ? pubs.reduce((a, b) => (b.numero > a.numero ? b : a)) : null;
  }, [listaProyecto]);
  const numeroSiguiente = listaProyecto.reduce((m, v) => Math.max(m, v.numero), 0) + 1;

  const entradas = useMemo(() => {
    const porId = new Map(desgloses.map((d) => [d.id_propiedad, d]));
    return propiedades
      .map((p) => ({ propiedad: p, desglose: porId.get(p.id_propiedad)! }))
      .filter((e) => e.desglose);
  }, [propiedades, desgloses]);

  const ofertasVigentes = useMemo(
    () =>
      ofertas.filter(
        (o) =>
          o.id_proyecto === idProyecto &&
          o.estado === "vigente" &&
          new Date(o.vence_en).getTime() >= Date.now(),
      ),
    [ofertas, idProyecto],
  );

  const evaluacion = useMemo(
    () =>
      evaluarPublicacion({
        motor,
        entradas,
        alertasPorUnidad,
        overrides,
        ofertasVigentes,
        versionPublicada: publicada,
      }),
    [motor, entradas, alertasPorUnidad, overrides, ofertasVigentes, publicada],
  );

  const soloBloqueoEsOfertas =
    evaluacion.bloqueos.length === 1 && evaluacion.bloqueos[0]?.codigo === "OFERTAS_VIGENTES";

  useEffect(() => {
    if (!abierto) {
      setNombre("");
      setNotas("");
      setConfirmadas([]);
      setExpandido(null);
      setAvisado(false);
      return;
    }
    setNombre(
      `Lista v${numeroSiguiente} · ${nombreProyecto} · ${formatoFechaCorta(new Date().toISOString())}`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  useEffect(() => {
    if (!abierto || avisado || evaluacion.bloqueos.length === 0) return;
    setAvisado(true);
    registrarEvento({
      id_proyecto: idProyecto,
      tipo: "version.publicacion_bloqueada",
      entidad: {
        tipo: "version",
        id: `intento-v${numeroSiguiente}`,
        etiqueta: `Intento de publicar v${numeroSiguiente}`,
      },
      antes: null,
      despues: {
        bloqueos: evaluacion.bloqueos.map((b) => b.codigo),
        detalle: evaluacion.bloqueos.map((b) => b.titulo),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, evaluacion.bloqueos, avisado]);

  const advertenciasSinConfirmar = evaluacion.advertencias.filter(
    (a) => !confirmadas.includes(a.codigo),
  );

  const construirDatos = (excluidas: { id_propiedad: string; motivo: string }[]) =>
    construirDatosVersion({
      idProyecto,
      nombre: nombre.trim() || `Lista v${numeroSiguiente}`,
      motor,
      entradas,
      excluidas,
      notas,
    });

  const publicarVersion = (excluidas: { id_propiedad: string; motivo: string }[]) => {
    const datos = construirDatos(excluidas);
    let version = encontrarBorradorReutilizable(listaProyecto, datos);
    if (!version) {
      version = crearBorrador(datos);
      registrarEvento({
        id_proyecto: idProyecto,
        tipo: "version.creada",
        entidad: {
          tipo: "version",
          id: version.id_version,
          etiqueta: `v${version.numero} · ${version.nombre}`,
        },
        antes: null,
        despues: {
          unidades_incluidas: version.unidades_incluidas.length,
          unidades_excluidas: version.unidades_excluidas.length,
          valor_total: version.valor_total,
        },
        impacto_pesos: null,
      });
    }
    publicar(idProyecto, version.id_version, datos.creada_por, notas);
    registrarEvento({
      id_proyecto: idProyecto,
      tipo: "version.publicada",
      entidad: {
        tipo: "version",
        id: version.id_version,
        etiqueta: `v${version.numero} · ${version.nombre}`,
      },
      antes: publicada
        ? { version: `v${publicada.numero}`, valor_total: publicada.valor_total }
        : null,
      despues: {
        version: `v${version.numero}`,
        valor_total: version.valor_total,
        unidades: version.unidades_incluidas.length,
        excluidas: version.unidades_excluidas.length,
      },
      impacto_pesos: publicada ? version.valor_total - publicada.valor_total : null,
      motivo: { causa: "Publicación de versión", descripcion: notas },
    });
    onOpenChange(false);
  };

  const puedePublicar =
    evaluacion.bloqueos.length === 0 &&
    advertenciasSinConfirmar.length === 0 &&
    nombre.trim().length > 0 &&
    notas.trim().length >= MIN_NOTAS;

  const datosResumen = useMemo(() => construirDatos([]), [
    idProyecto,
    nombre,
    motor,
    entradas,
    notas,
  ]);

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Publicar versión v{numeroSiguiente} · {nombreProyecto}
          </DialogTitle>
          <DialogDescription>
            Una versión publicada es inmutable: queda como referencia histórica y no puede
            editarse ni borrarse.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Unidades incluidas</dt>
            <dd className="text-foreground tabular-nums">
              {datosResumen.unidades_incluidas.length}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Unidades excluidas</dt>
            <dd className="text-foreground tabular-nums">
              {datosResumen.unidades_excluidas.length}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Valor total</dt>
            <dd className="text-foreground tabular-nums">
              {formatoMoneda(datosResumen.valor_total)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {publicada ? `Δ vs v${publicada.numero}` : "Valor de lista actual"}
            </dt>
            <dd className="text-foreground tabular-nums">
              {publicada
                ? formatoMoneda(datosResumen.valor_total - publicada.valor_total)
                : formatoMoneda(totales.totalActual)}
            </dd>
          </div>
        </dl>

        {evaluacion.bloqueos.map((b) => (
          <Collapsible
            key={b.codigo}
            open={expandido === b.codigo}
            onOpenChange={(o) => setExpandido(o ? b.codigo : null)}
            className="rounded-md border border-destructive/40 bg-destructive/5 p-3"
          >
            <div className="flex items-start gap-2">
              <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="flex-1 space-y-1">
                <CollapsibleTrigger asChild>
                  <button type="button" className="text-left">
                    <p className="text-sm font-semibold text-destructive">{b.titulo}</p>
                  </button>
                </CollapsibleTrigger>
                <p className="text-sm text-foreground">{b.detalle}</p>
                <CollapsibleContent>
                  {b.filas.length > 0 && (
                    <ul className="mt-1 max-h-40 list-inside list-disc overflow-y-auto text-xs text-muted-foreground tabular-nums">
                      {b.filas.slice(0, 60).map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  )}
                </CollapsibleContent>
                {b.filas.length > 0 && expandido !== b.codigo && (
                  <CollapsibleTrigger asChild>
                    <button type="button" className="text-xs text-destructive underline">
                      Ver detalle ({b.filas.length})
                    </button>
                  </CollapsibleTrigger>
                )}
              </div>
            </div>
          </Collapsible>
        ))}

        {evaluacion.advertencias.map((a) => (
          <div key={a.codigo} className="rounded-md border border-amber-300 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
              <div className="flex-1 space-y-1.5">
                <p className="text-sm font-semibold text-amber-900">{a.titulo}</p>
                <p className="text-sm text-amber-900/90">{a.detalle}</p>
                <label className="flex items-center gap-2 text-sm text-amber-900">
                  <Checkbox
                    checked={confirmadas.includes(a.codigo)}
                    onCheckedChange={() =>
                      setConfirmadas((prev) =>
                        prev.includes(a.codigo)
                          ? prev.filter((c) => c !== a.codigo)
                          : [...prev, a.codigo],
                      )
                    }
                  />
                  Entiendo el riesgo y quiero continuar
                </label>
              </div>
            </div>
          </div>
        ))}

        {evaluacion.bloqueos.length === 0 && evaluacion.advertencias.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sin bloqueos ni advertencias. La lista está lista para publicarse.
          </p>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombre-version">Nombre de la versión</Label>
            <Input
              id="nombre-version"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notas-version">Notas de la publicación</Label>
            <Textarea
              id="notas-version"
              rows={3}
              placeholder="Qué cambia respecto a la versión anterior y por qué. Mínimo 20 caracteres."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Estas notas quedan ligadas a la versión de forma permanente y son visibles para
              cualquiera que la consulte después.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            {soloBloqueoEsOfertas && (
              <Button
                variant="outline"
                disabled={
                  advertenciasSinConfirmar.length > 0 ||
                  nombre.trim().length === 0 ||
                  notas.trim().length < MIN_NOTAS
                }
                onClick={() =>
                  publicarVersion(
                    evaluacion.conflictosOferta.map((c) => ({
                      id_propiedad: c.id_propiedad,
                      motivo: `Oferta vigente hasta ${formatoFechaCorta(c.vence_en)}`,
                    })),
                  )
                }
              >
                Publicar excluyendo unidades con oferta vigente
              </Button>
            )}
            <Button disabled={!puedePublicar} onClick={() => publicarVersion([])}>
              Publicar versión
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
