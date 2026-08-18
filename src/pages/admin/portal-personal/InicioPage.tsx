import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Circle,
  Info,
  Loader2,
  Target,
  UserPlus,
} from "lucide-react";
import { usePortal } from "@/lib/portal-personal/portal-store";
import { EstadoCarga, EstadoError } from "@/components/admin/portal-personal/comunes/Estados";
import { mxn, selectores } from "@/lib/portal-personal/selectores";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalPersonalImpersonation } from "@/contexts/PortalPersonalImpersonationContext";
import { useComisionesPorEmail } from "@/hooks/useComisionesPorEmail";
import { useAvisosPersonal, useResumenReferidos, type TonoAviso } from "@/hooks/usePortalPersonalInicio";
import { usePerfilPersonal } from "@/hooks/usePortalPersonalPerfil";
import {
  useDepartamentosDisponibles,
  useProyectosComercializados,
} from "@/hooks/usePortalPersonalCatalogo";
import {
  montoComision,
  pctComision,
  useComisionesDelPersonal,
} from "@/hooks/usePortalPersonalComisiones";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Base sobre la que se estima la ganancia de la meta. */
type BaseCalculo = "promedio" | "departamento";

export default function InicioPage() {
  const usuario = usePortal((s) => s.usuario);
  const modo = usePortal((s) => s.modo_presentacion);
  const meta = usePortal((s) => s.meta);
  const ajustarMeta = usePortal((s) => s.ajustarMeta);
  const carga = usePortal((s) => s.carga);
  const setCarga = usePortal((s) => s.setCarga);

  const { profile } = useAuth();
  const { impersonatedUser, isImpersonating } = usePortalPersonalImpersonation();
  const email = ((isImpersonating ? impersonatedUser?.email : profile?.email) ?? "").trim();

  const { resumen, isLoading: cargandoResumen } = useResumenReferidos();
  const { comisiones, isLoading: cargandoComisiones } = useComisionesPorEmail(email || null);
  const { avisos, isLoading: cargandoAvisos } = useAvisosPersonal();
  const { perfil } = usePerfilPersonal();

  const [metaAbierta, setMetaAbierta] = useState(false);
  const [nuevoObjetivo, setNuevoObjetivo] = useState(String(meta.objetivo_referidos));

  // ── Estimación de la meta ──────────────────────────────────────────────────
  const { proyectos, isLoading: cargandoProyectos } = useProyectosComercializados();
  const [proyectoId, setProyectoId] = useState("");
  const [base, setBase] = useState<BaseCalculo>("promedio");
  const [departamentoId, setDepartamentoId] = useState("");
  const [canalSel, setCanalSel] = useState("");

  const proyecto = useMemo(
    () => proyectos.find((p) => p.id === proyectoId) ?? proyectos[0],
    [proyectos, proyectoId],
  );
  // Los departamentos solo se piden si el usuario elige uno específico: en el
  // Inicio no vale la pena traer el inventario completo de un proyecto.
  const { departamentos, isLoading: cargandoDepartamentos } = useDepartamentosDisponibles(
    base === "departamento" ? proyecto?.idNumerico : null,
  );
  const departamento = useMemo(
    () => departamentos.find((d) => d.id === departamentoId) ?? departamentos[0],
    [departamentos, departamentoId],
  );
  const { canales } = useComisionesDelPersonal(proyecto?.idNumerico);
  const canal = useMemo(
    () => canales.find((c) => c.idCanal === canalSel) ?? canales[0] ?? null,
    [canales, canalSel],
  );

  const totales = useMemo(() => {
    let cobrado = 0;
    let porCobrar = 0;
    for (const c of comisiones) {
      if (c.pagada) cobrado += c.monto_comision;
      else porCobrar += c.monto_comision;
    }
    return { cobrado, porCobrar };
  }, [comisiones]);

  if (carga === "cargando") return <EstadoCarga />;
  if (carga === "error") return <EstadoError onReintentar={() => setCarga("listo")} />;

  const pendientes = selectores.pendientesDeElegibilidad(usuario);
  const oculto = (v: string) => (modo ? "••••••" : v);

  const objetivo = Math.max(meta.objetivo_referidos, 1);
  const logrados = resumen.total;
  const faltan = Math.max(objetivo - logrados, 0);
  const avanceMeta = Math.min(Math.round((logrados / objetivo) * 100), 100);

  const precioBase =
    base === "departamento" && departamento
      ? departamento.precioTotal
      : proyecto?.precioPromedioPonderado ?? 0;
  const porVenta = canal ? montoComision(precioBase, canal.miPorcentaje) : 0;
  const potencial = porVenta * (faltan || objetivo);

  const kpis = [
    {
      label: "Ya cobrado",
      valor: mxn(totales.cobrado, 2),
      sub: "dispersado a tu cuenta",
      color: "text-verde",
      to: "/admin/portal-personal/ganancias",
      oculto: true,
    },
    {
      label: "Por cobrar",
      valor: mxn(totales.porCobrar, 2),
      sub: "en proceso",
      color: "text-ambar",
      to: "/admin/portal-personal/ganancias",
      oculto: true,
    },
    {
      label: "Mis referidos",
      valor: String(resumen.total),
      sub: "contactos a tu nombre",
      color: "text-negro",
      to: "/admin/portal-personal/referidos",
      oculto: false,
    },
    {
      label: "Con negocio",
      valor: String(resumen.conNegocio),
      sub: "ya en pipeline",
      color: "text-negro",
      to: "/admin/portal-personal/negocios",
      oculto: false,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h2 className="text-3xl font-bold uppercase leading-tight tracking-tight text-negro lg:text-4xl">
          {modo ? "•••••• ••••••" : usuario.nombre}
        </h2>
        <p className="mt-2 text-sm text-gris">
          <span className="font-semibold text-verde">{perfil?.rolAcceso ?? usuario.rol}</span>
          {perfil?.puesto ? ` · ${perfil.puesto}` : ""}
        </p>
      </header>

      {/* Elegibilidad — el badge se deriva de los pendientes, nunca se declara aparte */}
      <section className="card-sozu p-5">
        <p className="eyebrow text-gris">Tu elegibilidad</p>
        <div className="mt-3">
          {!usuario.elegible_referidos ? (
            <Badge variant="secondary" className="text-gris">
              No elegible
            </Badge>
          ) : pendientes.length > 0 ? (
            <Badge className="border-ambar-borde bg-ambar-claro text-negro hover:bg-ambar-claro">
              <AlertTriangle className="size-3.5 text-ambar" />
              Elegible — pendiente de activar
            </Badge>
          ) : (
            <Badge className="border-verde/30 bg-verde-claro text-verde-oscuro hover:bg-verde-claro">
              <CheckCircle2 className="size-3.5" />
              Elegible y activo
            </Badge>
          )}
        </div>

        {!usuario.elegible_referidos && usuario.motivo_inelegibilidad && (
          <p className="mt-3 text-sm text-gris">{usuario.motivo_inelegibilidad}</p>
        )}

        {usuario.elegible_referidos && pendientes.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-bold text-negro">Qué te falta</p>
            <ul className="mt-2 space-y-2">
              {pendientes.map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm text-gris">
                  <Circle className="size-3.5 text-ambar" />
                  {p}
                </li>
              ))}
            </ul>
            <Link
              to="/admin/portal-personal/perfil"
              className="mt-3 inline-flex text-sm font-semibold text-verde"
            >
              Completar en tu perfil
            </Link>
          </div>
        )}
      </section>

      {/* Cómo se registra un referido — reemplaza al antiguo link con código */}
      <section className="flex items-start gap-3 rounded-xl border border-verde/30 bg-verde-claro p-4">
        <UserPlus className="mt-0.5 size-4 shrink-0 text-verde-oscuro" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-negro">Así se registra un referido</p>
          <p className="mt-1 text-sm text-gris">
            Da de alta el contacto en <strong>Mis referidos</strong>. Queda ligado a ti
            automáticamente como su referidor y así se rastrea, sin códigos ni links que
            compartir.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 bg-background">
          <Link to="/admin/portal-personal/referidos">Registrar</Link>
        </Button>
      </section>

      {/* Acciones rápidas */}
      <section className="grid gap-4 sm:grid-cols-2">
        <AccionRapida
          to="/admin/portal-personal/simulador"
          icon={Calculator}
          titulo="Simular mis ganancias"
          subtitulo="Descubre cuánto puedes ganar"
        />
        <AccionRapida
          to="/admin/portal-personal/inventario"
          icon={Building2}
          titulo="Ver inventario"
          subtitulo="Explora lo disponible"
        />
      </section>

      {/* KPIs */}
      <section>
        <p className="eyebrow text-gris">Tus números</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <Link
              key={k.label}
              to={k.to}
              className="card-sozu flex items-center justify-between p-5 transition-colors hover:border-verde/40"
            >
              <div className="min-w-0">
                <p className="eyebrow text-gris">{k.label}</p>
                <p className={`num mt-2 truncate text-2xl font-bold ${k.color}`}>
                  {cargandoComisiones || cargandoResumen ? "—" : k.oculto && modo ? "••••••" : k.valor}
                </p>
                <p className="mt-1 text-xs text-gris">{k.sub}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-gris" />
            </Link>
          ))}
        </div>
      </section>

      {/* Mi meta — registrar referidos y estimar lo que pueden dejar */}
      <section>
        <p className="eyebrow text-gris">Mi meta</p>
        <div className="card-sozu mt-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-verde" />
              <p className="num text-sm font-bold text-negro">
                {cargandoResumen ? "…" : logrados} de {objetivo} referidos registrados
              </p>
            </div>
            <Button
              variant="link"
              className="h-auto p-0 text-verde"
              onClick={() => setMetaAbierta(true)}
            >
              Ajustar meta
            </Button>
          </div>
          <Progress value={avanceMeta} className="mt-3 h-2" />
          <p className="mt-2 text-sm text-gris">
            {faltan > 0
              ? `Te faltan ${faltan} para llegar a tu meta.`
              : "Ya alcanzaste tu meta. Ajústala para seguir midiéndote."}
          </p>

          {/* Estimación: vincula la meta con un proyecto o departamento probable */}
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-sm font-bold text-negro">
              ¿Cuánto te dejarían si los cierras?
            </p>
            <p className="mt-1 text-sm text-gris">
              Elige el proyecto —o el departamento— con el que crees que van a cerrar. El cálculo
              usa tu porcentaje real de comisión en ese canal.
            </p>

            {cargandoProyectos ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-gris">
                <Loader2 className="size-4 animate-spin" />
                Cargando proyectos...
              </div>
            ) : !proyecto ? (
              <p className="mt-4 text-sm text-gris">
                No hay proyectos comercializados por SOZU disponibles para tu usuario.
              </p>
            ) : (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs font-bold text-gris">Proyecto</Label>
                    <Select
                      value={proyecto.id}
                      onValueChange={(v) => {
                        setProyectoId(v);
                        setDepartamentoId("");
                        setCanalSel("");
                      }}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue>{proyecto.nombre}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {proyectos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-gris">Base de cálculo</Label>
                    <Select value={base} onValueChange={(v) => setBase(v as BaseCalculo)}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="promedio">Precio promedio del proyecto</SelectItem>
                        <SelectItem value="departamento">Un departamento específico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {base === "departamento" ? (
                    <div>
                      <Label className="text-xs font-bold text-gris">Departamento</Label>
                      <Select
                        value={departamento?.id ?? ""}
                        onValueChange={setDepartamentoId}
                        disabled={cargandoDepartamentos || departamentos.length === 0}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue
                            placeholder={
                              cargandoDepartamentos ? "Cargando..." : "Sin departamentos disponibles"
                            }
                          >
                            {departamento ? `Depto. ${departamento.numero}` : ""}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {departamentos.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              Depto. {d.numero} · {d.modelo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs font-bold text-gris">Canal de venta</Label>
                      <Select
                        value={canal?.idCanal ?? ""}
                        onValueChange={setCanalSel}
                        disabled={canales.length === 0}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Sin canales asignados">
                            {canal ? canal.canal : ""}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {canales.map((c) => (
                            <SelectItem key={c.idCanal} value={c.idCanal}>
                              {c.canal} · {pctComision(c.miPorcentaje)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {canales.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-border bg-secondary p-4 text-sm text-gris">
                    No tienes comisión asignada en ningún canal de {proyecto.nombre}, así que no
                    podemos estimar tu ganancia aquí. Prueba con otro proyecto.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-4 rounded-xl bg-verde-claro p-4 sm:grid-cols-2">
                    <div>
                      <p className="eyebrow text-gris">Por cada venta</p>
                      <p className="num mt-1 text-2xl font-bold text-verde">
                        {oculto(mxn(porVenta, 2))}
                      </p>
                      <p className="num mt-0.5 text-xs text-gris">
                        {canal ? `${pctComision(canal.miPorcentaje)} · ${canal.canal}` : ""}
                        {base === "departamento" && departamento
                          ? ` · Depto. ${departamento.numero}`
                          : " · precio promedio ponderado"}
                      </p>
                    </div>
                    <div>
                      <p className="eyebrow text-gris">
                        {faltan > 0 ? `Si cierras los ${faltan} que faltan` : `Si cierras ${objetivo}`}
                      </p>
                      <p className="num mt-1 text-2xl font-bold text-verde">
                        {oculto(mxn(potencial, 2))}
                      </p>
                      <p className="mt-0.5 text-xs text-gris">Estimación, no una promesa de pago.</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button asChild>
                    <Link to="/admin/portal-personal/referidos">
                      <UserPlus className="size-4" />
                      Registrar un referido
                    </Link>
                  </Button>
                  <Link
                    to={`/admin/portal-personal/simulador?proyecto=${proyecto.idNumerico}`}
                    className="text-sm font-semibold text-verde"
                  >
                    Abrir el simulador completo
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Avisos — derivados de sus datos + comunicados dirigidos a su rol */}
      <section>
        <p className="eyebrow text-gris">Avisos</p>
        {cargandoAvisos ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-gris">
            <Loader2 className="size-4 animate-spin" />
            Revisando tus pendientes...
          </div>
        ) : avisos.length === 0 ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-secondary p-4">
            <CheckCircle2 className="size-4 shrink-0 text-verde" />
            <p className="text-sm text-negro">No tienes avisos pendientes.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {avisos.map((a) => (
              <Aviso key={a.id} tono={a.tono}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-negro">{a.titulo}</p>
                  {a.detalle && <p className="mt-0.5 text-sm text-gris">{a.detalle}</p>}
                </div>
                {a.accion && (
                  <Button asChild variant="outline" className="shrink-0 bg-background">
                    <Link to={a.accion.to}>{a.accion.texto}</Link>
                  </Button>
                )}
              </Aviso>
            ))}
          </div>
        )}
      </section>

      <Dialog open={metaAbierta} onOpenChange={setMetaAbierta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar meta</DialogTitle>
            <DialogDescription>
              Define cuántos referidos quieres registrar este año. El avance se mide con los
              contactos que ya tienes a tu nombre en Mis referidos.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="number"
            min={1}
            max={200}
            value={nuevoObjetivo}
            onChange={(e) => setNuevoObjetivo(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaAbierta(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                ajustarMeta(Math.max(1, Number(nuevoObjetivo) || 1));
                setMetaAbierta(false);
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const TONO_AVISO: Record<TonoAviso, string> = {
  ambar: "border-ambar-borde bg-ambar-claro",
  verde: "border-verde/30 bg-verde-claro",
  gris: "border-border bg-secondary",
};

const ICONO_AVISO: Record<TonoAviso, typeof AlertTriangle> = {
  ambar: AlertTriangle,
  verde: CheckCircle2,
  gris: Info,
};

function Aviso({ tono, children }: { tono: TonoAviso; children: React.ReactNode }) {
  const Icono = ICONO_AVISO[tono];
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center",
        TONO_AVISO[tono],
      )}
    >
      <Icono
        className={cn(
          "size-4 shrink-0",
          tono === "ambar" && "text-ambar",
          tono === "verde" && "text-verde-oscuro",
          tono === "gris" && "text-gris",
        )}
      />
      {children}
    </div>
  );
}

function AccionRapida({
  to,
  icon: Icon,
  titulo,
  subtitulo,
}: {
  to: string;
  icon: typeof Calculator;
  titulo: string;
  subtitulo: string;
}) {
  return (
    <Link
      to={to}
      className="card-sozu flex items-center gap-4 p-5 transition-colors hover:border-verde/40"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-verde-claro">
        <Icon className="size-5 text-verde-oscuro" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-negro">{titulo}</span>
        <span className="block text-sm text-gris">{subtitulo}</span>
      </span>
      <ChevronRight className="size-4 text-gris" />
    </Link>
  );
}
