import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Bath,
  Bed,
  Car,
  ChevronLeft,
  ChevronRight,
  FileText,
  Building2,
  Download,
  Layers,
  MoveDiagonal,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  gananciaPorUnidad,
  lineaDeCobro,
  mxn,
  precioTotalUnidad,
  selectores,
} from "@/lib/portal-personal/selectores";
import { FILTROS_VACIOS, usePortal } from "@/lib/portal-personal/portal-store";
import type { FiltrosInventario } from "@/lib/portal-personal/portal-store";
import type { Unidad } from "@/lib/portal-personal/tipos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  EstadoCargaTarjetas,
  EstadoError,
  EstadoVacio,
} from "@/components/admin/portal-personal/comunes/Estados";
import { cn } from "@/lib/utils";
import { opcionesEstacionamiento } from "@/utils/estacionamientoFiltro";


export default function InventarioDetallePage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const modo = usePortal((s) => s.modo_presentacion);

  // SWAP POINT: supabase.desarrollos / supabase.unidades
  const desarrollo = selectores.desarrolloPorSlug(slug);
  const unidades = useMemo(
    () => (desarrollo ? selectores.unidadesDe(desarrollo.id) : []),
    [desarrollo],
  );

  const precios = unidades.map((u) => precioTotalUnidad(u));
  const min = precios.length ? Math.min(...precios) : 0;
  const max = precios.length ? Math.max(...precios) : 0;

  // El estado del módulo vive en el store: se conserva durante la sesión.
  const guardados = usePortal((s) => s.filtros_inventario[slug]);
  const setFiltrosStore = usePortal((s) => s.setFiltrosInventario);
  const limpiarStore = usePortal((s) => s.limpiarFiltrosInventario);
  const abrirNivel = usePortal((s) => s.abrirNivelInventario);
  const carga = usePortal((s) => s.carga);
  const setCarga = usePortal((s) => s.setCarga);

  const filtros: FiltrosInventario = guardados ?? FILTROS_VACIOS;
  const rango: [number, number] = filtros.rango ?? [min, max];
  const setFiltros = (f: Partial<FiltrosInventario>) =>
    setFiltrosStore(slug, { ...filtros, ...f });
  const limpiar = () => limpiarStore(slug);
  const q = filtros.q;

  const [drawer, setDrawer] = useState(false);
  const [detalle, setDetalle] = useState<Unidad | null>(null);

  useEffect(() => {
    abrirNivel(slug, detalle?.id ?? null);
  }, [abrirNivel, slug, detalle]);

  if (!desarrollo) {
    return (
      <EstadoVacio
        titulo="Desarrollo no encontrado"
        descripcion="Revisa el enlace o vuelve al listado de desarrollos."
      />
    );
  }

  const activos =
    (filtros.modelo !== "todos" ? 1 : 0) +
    (filtros.nivel !== "todos" ? 1 : 0) +
    (filtros.recamaras !== "todas" ? 1 : 0) +
    (filtros.bodega !== "todas" ? 1 : 0) +
    (filtros.estacionamiento !== "todos" ? 1 : 0) +
    (rango[0] !== min || rango[1] !== max ? 1 : 0);

  const lista = unidades.filter((u) => {
    const total = precioTotalUnidad(u);
    const texto = `${u.numero} ${u.modelo}`.toLowerCase();
    return (
      texto.includes(q.toLowerCase()) &&
      (filtros.modelo === "todos" || u.modelo === filtros.modelo) &&
      (filtros.nivel === "todos" || String(u.nivel) === filtros.nivel) &&
      (filtros.recamaras === "todas" || String(u.recamaras) === filtros.recamaras) &&
      (filtros.bodega === "todas" ||
        (filtros.bodega === "si" ? u.bodegas > 0 : u.bodegas === 0)) &&
      (filtros.estacionamiento === "todos" ||
        String(u.estacionamientos) === filtros.estacionamiento) &&
      total >= rango[0] &&
      total <= rango[1]
    );
  });

  const modelos = [...new Set(unidades.map((u) => u.modelo))];
  const niveles = [...new Set(unidades.map((u) => u.nivel))].sort((a, b) => a - b);
  // Cantidades de cajones que existen en este proyecto: el select no ofrece opciones
  // que devolverían cero unidades, y admite 3 o 4 en cuanto haya inventario así.
  const opcionesCajones = opcionesEstacionamiento(unidades.map((u) => Number(u.estacionamientos)));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="icon" className="size-10 rounded-full">
          <Link to="/admin/portal-personal/inventario" aria-label="Regresar a desarrollos">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>

        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gris" />
          <Input
            value={q}
            onChange={(e) => setFiltros({ q: e.target.value })}
            placeholder="Buscar unidad..."
            className="h-11 bg-background pl-9"
          />
        </div>

        <Button variant="outline" className="h-11" onClick={() => setDrawer(true)}>
          <SlidersHorizontal className="size-4" />
          Filtros
          {activos > 0 && (
            <span className="num ml-1 flex size-5 items-center justify-center rounded-full bg-verde text-[11px] font-bold text-white">
              {activos}
            </span>
          )}
        </Button>

        {activos > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="size-11 bg-verde-claro text-verde-oscuro hover:bg-verde-claro"
            aria-label="Limpiar filtros"
            onClick={limpiar}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-negro">{desarrollo.nombre}</h2>
        <p className="num text-sm text-gris">
          {lista.length} unidades · Avance de obra {desarrollo.avance_obra}% · Entrega{" "}
          {desarrollo.entrega_estimada}
        </p>
      </div>

      {carga === "cargando" ? (
        <EstadoCargaTarjetas />
      ) : carga === "error" ? (
        <EstadoError onReintentar={() => setCarga("listo")} />
      ) : unidades.length === 0 ? (
        <EstadoVacio
          icono={Building2}
          titulo="Sin unidades disponibles"
          descripcion="Este desarrollo no tiene unidades disponibles en este momento."
        />
      ) : lista.length === 0 ? (
        <EstadoVacio
          icono={Building2}
          titulo="Ninguna unidad coincide con tus filtros"
          descripcion="Ajusta los filtros o límpialos para ver todas las unidades del desarrollo."
          accion={{ etiqueta: "Limpiar filtros", onClick: limpiar }}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setDetalle(u)}
              className="card-sozu flex h-full flex-col overflow-hidden text-left transition-colors hover:border-verde/40"
            >
              <div className="relative">
                <img
                  src={u.imagenes[0]}
                  alt={`Interior de la unidad ${u.numero}`}
                  loading="lazy"
                  width={1024}
                  height={640}
                  className="aspect-[16/10] w-full rounded-t-xl object-cover"
                />
                <span className="num absolute right-3 top-3 rounded-full bg-background px-3 py-1 text-xs font-semibold text-negro shadow-sm">
                  Depto. {u.numero}
                </span>
              </div>

              <div className="space-y-2 p-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-negro">
                  {u.modelo}
                </h3>
                <p className="text-sm text-gris">
                  {desarrollo.nombre} · Nivel {u.nivel}
                </p>
                <p className="num text-xl font-bold text-verde">{mxn(u.precio)}</p>

                <div className="border-t border-border pt-3">
                  <div className="num flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-negro">
                    <span className="inline-flex items-center gap-1">
                      <MoveDiagonal className="size-3.5 text-verde" />
                      {u.superficie} m<sup>2</sup>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Bed className="size-3.5 text-verde" />
                      {u.recamaras}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Bath className="size-3.5 text-verde" />
                      {u.banos}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Archive className="size-3.5 text-verde" />
                      {u.bodegas}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Car className="size-3.5 text-verde" />
                      {u.estacionamientos}
                    </span>
                  </div>
                </div>

                {!modo && (
                  <div className="flex justify-end pt-1">
                    <span className="num inline-flex rounded-full bg-verde-claro px-3 py-1 text-xs font-semibold text-verde-oscuro">
                      Ganas ~{mxn(gananciaPorUnidad(u))}
                    </span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* DRAWER: FILTROS */}
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-[470px]">
          <div className="border-b border-border px-6 py-5">
            <h3 className="text-lg font-bold text-negro">Filtros</h3>
            <p className="mt-1 text-sm text-gris">
              Filtra las unidades disponibles. Los cambios se aplican al instante.
            </p>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div>
              <Label className="font-bold">Desarrollo</Label>
              <Select value={desarrollo.slug} onValueChange={(v) => navigate(`/admin/portal-personal/inventario/${v}`)}>
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectores.desarrollos().map((d) => (
                    <SelectItem key={d.id} value={d.slug}>
                      {d.nombre} ({selectores.unidadesDe(d.id).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <FiltroSelect
              label="Modelo"
              value={filtros.modelo}
              onChange={(v) => setFiltros({ modelo: v })}
              opciones={[{ v: "todos", l: "Todos" }, ...modelos.map((m) => ({ v: m, l: m }))]}
            />
            <FiltroSelect
              label="Nivel"
              value={filtros.nivel}
              onChange={(v) => setFiltros({ nivel: v })}
              opciones={[
                { v: "todos", l: "Todos" },
                ...niveles.map((n) => ({ v: String(n), l: `Nivel ${n}` })),
              ]}
            />
            <FiltroSelect
              label="Recámaras"
              value={filtros.recamaras}
              onChange={(v) => setFiltros({ recamaras: v })}
              opciones={[
                { v: "todas", l: "Todas" },
                { v: "1", l: "1" },
                { v: "2", l: "2" },
                { v: "3", l: "3" },
              ]}
            />

            <div className="grid grid-cols-2 gap-4">
              <FiltroSelect
                label="Bodega"
                value={filtros.bodega}
                onChange={(v) => setFiltros({ bodega: v })}
                opciones={[
                  { v: "todas", l: "Todas" },
                  { v: "si", l: "Con bodega" },
                  { v: "no", l: "Sin bodega" },
                ]}
              />
              <FiltroSelect
                label="Estacionamiento"
                value={filtros.estacionamiento}
                onChange={(v) => setFiltros({ estacionamiento: v })}
                opciones={opcionesCajones.map((o) => ({ v: o.value, l: o.label }))}
              />
            </div>

            <div>
              <Label className="font-bold">Rango de precio</Label>
              <Slider
                className="mt-4"
                min={min}
                max={max}
                step={50000}
                value={rango}
                onValueChange={(v) => setFiltros({ rango: [v[0] ?? min, v[1] ?? max] })}
              />
              <div className="num mt-3 flex items-center gap-2 text-xs">
                <span className="rounded-md bg-secondary px-2.5 py-1 text-gris">
                  {mxn(rango[0])}
                </span>
                <span className="text-gris">a</span>
                <span className="rounded-md bg-secondary px-2.5 py-1 text-gris">
                  {mxn(rango[1])}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <Button variant="ghost" className="text-gris" onClick={limpiar}>
              Limpiar
            </Button>
            <Button onClick={() => setDrawer(false)}>Ver resultados</Button>
          </div>
        </SheetContent>
      </Sheet>

      {detalle && (
        <ModalUnidad unidad={detalle} onClose={() => setDetalle(null)} slug={slug} />
      )}
    </div>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  opciones,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opciones: { v: string; l: string }[];
}) {
  return (
    <div>
      <Label className="font-bold">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-2 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((o) => (
            <SelectItem key={o.v} value={o.v}>
              {o.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ModalUnidad({
  unidad,
  onClose,
  slug,
}: {
  unidad: Unidad;
  onClose: () => void;
  slug: string;
}) {
  const modo = usePortal((s) => s.modo_presentacion);
  const desarrollo = selectores.desarrolloPorId(unidad.desarrollo_id)!;
  const esquemas = selectores.esquemasDe(unidad.id);
  const [foto, setFoto] = useState(0);
  const [esquema, setEsquema] = useState(esquemas[0]?.id ?? "");
  const [planos, setPlanos] = useState(false);
  const [pestanaPlano, setPestanaPlano] = useState<"ubicacion" | "arquitectonico">(
    "ubicacion",
  );

  const total = precioTotalUnidad(unidad);
  const nodos = lineaDeCobro(desarrollo, 1);
  const trimestreDePago = nodos[nodos.length - 1]?.fecha ?? desarrollo.entrega_estimada;
  const seleccionado = esquemas.find((e) => e.id === esquema) ?? esquemas[0];

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent

          className="max-h-[92vh] w-[95vw] max-w-5xl overflow-hidden p-0 sm:max-w-5xl"
        >
          <div className="grid max-h-[92vh] grid-cols-1 md:grid-cols-2">
            <div className="relative hidden bg-secondary md:block">
              <img
                src={unidad.imagenes[foto]}
                alt={`Unidad ${unidad.numero}, imagen ${foto + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                aria-label="Imagen anterior"
                onClick={() => setFoto((f) => (f - 1 + unidad.imagenes.length) % unidad.imagenes.length)}
                className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/70"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Imagen siguiente"
                onClick={() => setFoto((f) => (f + 1) % unidad.imagenes.length)}
                className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/70"
              >
                <ChevronRight className="size-4" />
              </button>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
                {unidad.imagenes.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full bg-background transition-all",
                      i === foto ? "w-6" : "w-1.5 opacity-60",
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="flex max-h-[92vh] flex-col">
              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                <div>
                  <h3 className="text-xl font-bold text-negro">
                    Departamento {unidad.numero}
                  </h3>
                  <p className="text-sm text-gris">{desarrollo.nombre}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Chip>{desarrollo.nombre.toUpperCase()}</Chip>
                    <Chip>{unidad.modelo}</Chip>
                    <Chip>
                      <Layers className="size-3.5" />
                      Nivel {unidad.nivel}
                    </Chip>
                  </div>
                </div>

                <div className="num grid grid-cols-2 gap-3 rounded-xl border border-border p-4 text-sm">
                  <Attr icon={MoveDiagonal} label="Superficie">
                    {unidad.superficie} m<sup>2</sup>
                  </Attr>
                  <Attr icon={Bed} label="Recámaras">
                    {unidad.recamaras}
                  </Attr>
                  <Attr icon={Bath} label="Baños">
                    {unidad.banos}
                  </Attr>
                  <Attr icon={Archive} label="Bodegas">
                    {unidad.bodegas}
                  </Attr>
                  <Attr icon={Car} label="Estacionamientos">
                    {unidad.estacionamientos}{" "}
                    <span className="text-gris">({unidad.tipo_estacionamiento})</span>
                  </Attr>
                </div>

                <Button variant="outline" className="w-full" onClick={() => setPlanos(true)}>
                  <FileText className="size-4" />
                  Ver planos
                </Button>

                <div className="rounded-xl bg-verde-claro p-4">
                  <div className="num flex items-center justify-between text-sm">
                    <span className="text-negro">Propiedad</span>
                    <span className="font-semibold text-negro">{mxn(unidad.precio)}</span>
                  </div>
                  {unidad.productos_adicionales.map((p) => (
                    <div
                      key={p.clave}
                      className="num mt-2 flex items-center justify-between pl-4 text-sm text-gris"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Archive className="size-3.5 text-verde" />
                        {p.clave}
                      </span>
                      <span>+{mxn(p.monto)}</span>
                    </div>
                  ))}
                  <div className="my-3 h-px bg-verde/25" />
                  <div className="flex items-center justify-between">
                    <span className="eyebrow text-gris">Total</span>
                    <span className="num text-xl font-bold text-verde">{mxn(total)}</span>
                  </div>
                </div>

                {!modo && (
                  <div className="rounded-xl border border-verde/30 bg-verde-claro p-4">
                    <p className="eyebrow text-gris">Lo que ganas con esta unidad</p>
                    <p className="num mt-1 text-3xl font-bold text-verde">
                      {mxn(gananciaPorUnidad(unidad))}
                    </p>
                    {/* El trimestre es la fecha de TU pago, no la de escrituración. */}
                    <p className="num mt-1 text-sm text-gris">Cobrable ~{trimestreDePago}</p>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-[3px] rounded-full bg-verde" />
                    <h4 className="text-sm font-bold text-negro">Esquemas de Pago</h4>
                    <span className="num flex size-5 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-gris">
                      {esquemas.length}
                    </span>
                  </div>

                  <RadioGroup value={esquema} onValueChange={setEsquema} className="mt-3 space-y-3">
                    {esquemas.map((e) => (
                      <label
                        key={e.id}
                        className={cn(
                          "block cursor-pointer rounded-xl border p-4",
                          e.id === esquema ? "border-verde bg-verde-claro/40" : "border-border",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value={e.id} id={e.id} />
                          <span className="text-sm font-bold text-negro">{e.nombre}</span>
                        </div>

                        <div className="num mt-3 flex flex-wrap gap-2 text-xs">
                          <Chip>
                            <b>{e.pct_enganche}%</b>
                            <span className="text-gris">Enganche</span>
                          </Chip>
                          <Chip>
                            <b>{e.pct_mensualidades}%</b>
                            <span className="text-gris">Mensualidades</span>
                          </Chip>
                          <Chip>
                            <b>{e.pct_entrega}%</b>
                            <span className="text-gris">Entrega</span>
                          </Chip>
                          <Chip>{e.plazo_meses} meses</Chip>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <p className="eyebrow text-gris">Enganche</p>
                            <p className="num text-sm font-bold text-negro">
                              {mxn((total * e.pct_enganche) / 100)}
                            </p>
                          </div>
                          <div>
                            <p className="eyebrow text-gris">
                              Mensualidad × {e.plazo_meses}
                            </p>
                            <p className="num text-sm font-bold text-negro">
                              {mxn(
                                (total * e.pct_mensualidades) / 100 / Math.max(e.plazo_meses, 1),
                              )}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </div>


                <p className="text-xs text-gris">
                  Esquema seleccionado: {seleccionado?.nombre ?? "—"}. Desarrollado por Tallwood y
                  comercializado por REV (SOZU).
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border p-4">
                <Button variant="outline" onClick={onClose}>
                  Cerrar
                </Button>
                <Button asChild variant="outline" className="border-verde text-verde-oscuro">
                  <Link
                    to={`/admin/portal-personal/simulador?unidad=${encodeURIComponent(unidad.id)}&desarrollo=${encodeURIComponent(slug)}`}
                    onClick={onClose}
                  >
                    Simular esta unidad
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={planos} onOpenChange={setPlanos}>
        <DialogContent className="max-w-3xl p-0">
          <div className="border-b border-border p-5">
            <h3 className="text-lg font-bold text-negro">Planos - {unidad.modelo}</h3>
            {/* SWAP POINT: supabase.planos */}
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
              {(
                [
                  ["ubicacion", "Ubicación"],
                  ["arquitectonico", "Arquitectónico"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPestanaPlano(v)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-xs font-semibold transition-colors",
                    pestanaPlano === v
                      ? "bg-verde text-white"
                      : "text-gris hover:text-negro",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center bg-secondary/60 p-8">
            <div className="num relative w-full max-w-md rounded-lg border-2 border-negro bg-background p-8 text-center">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-2 text-xs text-rojo">
                {unidad.superficie} m<sup>2</sup>
              </span>
              <span className="absolute -left-4 top-1/2 -translate-y-1/2 rotate-[-90deg] bg-background px-2 text-xs text-rojo">
                {(unidad.superficie / 8).toFixed(1)} m
              </span>
              <p className="text-sm font-bold text-negro">
                {pestanaPlano === "ubicacion"
                  ? `Nivel ${unidad.nivel} · ${desarrollo.nombre}`
                  : unidad.modelo}
              </p>
              <p className="num mt-1 text-xs text-gris">
                {pestanaPlano === "ubicacion"
                  ? `Ubicación de la unidad ${unidad.numero} dentro del nivel`
                  : `${unidad.recamaras} rec · ${unidad.banos} baños · ${unidad.superficie} m²`}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border p-4">
            <Button variant="outline" onClick={() => setPlanos(false)}>
              Cerrar
            </Button>
            <Button variant="outline" className="border-verde text-verde-oscuro">
              <Download className="size-4" />
              Descargar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-negro">
      {children}
    </span>
  );
}

function Attr({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Bed;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-gris" />
      <div>
        <p className="text-[11px] text-gris">{label}</p>
        <p className="text-sm font-semibold text-negro">{children}</p>
      </div>
    </div>
  );
}
