import {Link} from "react-router-dom";
import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Circle,
  Target,
} from "lucide-react";
import { usePortal } from "@/lib/portal-personal/portal-store";
import { LinkReferido } from "@/components/admin/portal-personal/comunes/LinkReferido";
import { EstadoCarga, EstadoError } from "@/components/admin/portal-personal/comunes/Estados";
import { mxn, selectores } from "@/lib/portal-personal/selectores";
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


export default function InicioPage() {
  const usuario = usePortal((s) => s.usuario);
  const modo = usePortal((s) => s.modo_presentacion);
  const meta = usePortal((s) => s.meta);
  const ajustarMeta = usePortal((s) => s.ajustarMeta);
  const referidos = usePortal((s) => s.referidos);
  const carga = usePortal((s) => s.carga);
  const setCarga = usePortal((s) => s.setCarga);

  const [metaAbierta, setMetaAbierta] = useState(false);
  const [nuevoObjetivo, setNuevoObjetivo] = useState(String(meta.objetivo_referidos));

  if (carga === "cargando") return <EstadoCarga />;
  if (carga === "error") return <EstadoError onReintentar={() => setCarga("listo")} />;

  const pendientes = selectores.pendientesDeElegibilidad(usuario);
  const sinConfirmar = referidos.filter((r) => r.estado === "pendiente_confirmacion").length;

  // SWAP POINT: supabase.ganancias
  const yaCobrado = selectores.yaCobrado();
  const porCobrar = selectores.porCobrar();
  const activos = referidos.filter(
    (r) => r.estado === "confirmado" || r.estado === "en_seguimiento",
  ).length;
  const cerrados = selectores
    .negociosDelColaborador()
    .filter((n) => n.etapa === "escriturado").length;

  const kpis = [
    { label: "Ya cobrado", valor: mxn(yaCobrado), sub: "en tu cuenta", color: "text-verde", to: "/admin/portal-personal/ganancias", oculto: true },
    { label: "Por cobrar", valor: mxn(porCobrar), sub: "en proceso", color: "text-ambar", to: "/admin/portal-personal/ganancias", oculto: true },
    { label: "Referidos activos", valor: String(activos), sub: "en pipeline", color: "text-negro", to: "/admin/portal-personal/referidos", oculto: false },
    { label: "Cerrados", valor: String(cerrados), sub: "escriturados", color: "text-negro", to: "/admin/portal-personal/negocios", oculto: false },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h2 className="text-3xl font-bold uppercase leading-tight tracking-tight text-negro lg:text-4xl">
          {modo ? "•••••• ••••••" : usuario.nombre}
        </h2>
        <p className="mt-2 text-sm text-gris">
          <span className="font-semibold text-verde">{usuario.rol}</span>
          {" · "}
          {etiquetaColaborador(usuario.tipo_colaborador)}
          {" · "}
          Último acceso: {usuario.ultimo_acceso}
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
            <Link to="/admin/portal-personal/perfil" className="mt-3 inline-flex text-sm font-semibold text-verde">
              Completar en tu perfil
            </Link>
          </div>
        )}
      </section>


      <LinkReferido />

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
              <div>
                <p className="eyebrow text-gris">{k.label}</p>
                <p className={`num mt-2 text-2xl font-bold ${k.color}`}>
                  {k.oculto && modo ? "••••••" : k.valor}
                </p>
                <p className="mt-1 text-xs text-gris">{k.sub}</p>
              </div>
              <ChevronRight className="size-4 text-gris" />
            </Link>
          ))}
        </div>
      </section>

      {/* Meta */}
      <section>
        <p className="eyebrow text-gris">Mi meta</p>
        {/* SWAP POINT: supabase.metas_personales */}
        <div className="card-sozu mt-3 p-5">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-verde" />
            <p className="num text-sm font-bold text-negro">
              {meta.logrados} de {meta.objetivo_referidos} referidos este año
            </p>
          </div>
          <Progress
            value={(meta.logrados / meta.objetivo_referidos) * 100}
            className="mt-3 h-2"
          />
          <Button
            variant="link"
            className="mt-2 h-auto p-0 text-verde"
            onClick={() => setMetaAbierta(true)}
          >
            Ajustar meta
          </Button>
        </div>
      </section>

      {/* Avisos */}
      {sinConfirmar > 0 && (
        <section>
          <p className="eyebrow text-gris">Avisos</p>
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-ambar-borde bg-ambar-claro p-4 sm:flex-row sm:items-center">
            <AlertTriangle className="size-4 shrink-0 text-ambar" />
            <p className="num flex-1 text-sm text-negro">
              Tienes {sinConfirmar} referido{sinConfirmar > 1 ? "s" : ""} sin confirmar sus datos.
            </p>
            <Button asChild variant="outline" className="border-ambar bg-background text-negro">
              <Link to="/admin/portal-personal/referidos">Revisar</Link>
            </Button>
          </div>
        </section>
      )}

      <Dialog open={metaAbierta} onOpenChange={setMetaAbierta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar meta</DialogTitle>
            <DialogDescription>
              Define cuántos referidos quieres lograr este año.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="number"
            min={1}
            max={50}
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

export function etiquetaColaborador(t: string): string {
  if (t === "EMPLEADO_REV") return "Empleado REV";
  if (t === "COLAB_INVESTIMENTO") return "Colaborador Investimento";
  return "Personal Tallwood";
}
