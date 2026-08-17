
import { useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  MessageCircle,
  PenLine,
  Plus,
  Search,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { usePortal } from "@/lib/portal-personal/portal-store";
import { lineaDeCobro, mxn, selectores } from "@/lib/portal-personal/selectores";
import type { Referido } from "@/lib/portal-personal/tipos";
import { LinkReferido } from "@/components/admin/portal-personal/comunes/LinkReferido";
import { LineaCobro } from "@/components/admin/portal-personal/comunes/LineaCobro";
import { EstadoVacio } from "@/components/admin/portal-personal/comunes/Estados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";


const ESTADOS = [
  { v: "pendiente_confirmacion", l: "Sin confirmar", color: "bg-ambar" },
  { v: "confirmado", l: "Confirmado", color: "bg-verde" },
  { v: "en_seguimiento", l: "En seguimiento", color: "bg-verde" },
  { v: "con_compra", l: "Con compra", color: "bg-verde-oscuro" },
  { v: "sin_interes", l: "Sin interés", color: "bg-gris" },
] as const;

const ICONO_ACTIVIDAD = {
  registro: UserPlus,
  contacto: MessageCircle,
  cita: CalendarCheck,
  oferta: FileText,
  contrato: PenLine,
} as const;

export default function ReferidosPage() {
  const referidos = usePortal((s) => s.referidos);
  const modo = usePortal((s) => s.modo_presentacion);
  const cambiarEstado = usePortal((s) => s.cambiarEstadoReferido);

  const [q, setQ] = useState("");
  const [fEstado, setFEstado] = useState("todos");
  const [fDesarrollo, setFDesarrollo] = useState("todos");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [modal, setModal] = useState(false);

  // SWAP POINT: supabase.referidos
  const lista = referidos.filter((r) => {
    const texto = `${r.nombre} ${r.correo} ${r.telefono} ${r.desarrollos_interes.join(" ")}`
      .toLowerCase()
      .includes(q.toLowerCase());
    return (
      texto &&
      (fEstado === "todos" || r.estado === fEstado) &&
      (fDesarrollo === "todos" || r.desarrollos_interes.includes(fDesarrollo))
    );
  });

  const sinConfirmar = referidos.filter((r) => r.estado === "pendiente_confirmacion").length;
  const conCompra = referidos.filter((r) => r.estado === "con_compra").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <LinkReferido variante="barra" metrica="12 visitas · 3 registros" />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gris" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, correo, teléfono o desarrollo..."
            className="h-11 bg-background pl-9"
          />
        </div>

        <Select value={fEstado} onValueChange={setFEstado}>
          <SelectTrigger className="h-11 w-[180px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {ESTADOS.map((e) => (
              <SelectItem key={e.v} value={e.v}>
                {e.l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={fDesarrollo} onValueChange={setFDesarrollo}>
          <SelectTrigger className="h-11 w-[180px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los desarrollos</SelectItem>
            {selectores.desarrollos().map((d) => (
              <SelectItem key={d.id} value={d.nombre}>
                {d.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button className="h-11" onClick={() => setModal(true)}>
          <Plus className="size-4" />
          Registrar manualmente
        </Button>
      </div>

      <p className="num eyebrow text-gris">
        {referidos.length} referidos · {sinConfirmar} sin confirmar · {conCompra} con compra
      </p>

      {lista.length === 0 ? (
        <EstadoVacio
          titulo="Aún no tienes referidos aquí"
          descripcion="Comparte tu link para que las personas se registren a tu nombre automáticamente."
        />
      ) : (
        <div className="card-sozu overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["", "Referido", "Contacto", "Origen", "Desarrollos", "Estado", "Ganancia potencial", ""].map(
                  (h, i) => (
                    <th
                      key={`${h}-${i}`}
                      className="eyebrow whitespace-nowrap px-4 py-3 text-gris"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <FilaReferido
                  key={r.id}
                  referido={r}
                  modo={modo}
                  abierto={expandido === r.id}
                  onToggle={() => setExpandido(expandido === r.id ? null : r.id)}
                  onEstado={(e) => cambiarEstado(r.id, e)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModalRegistro open={modal} onOpenChange={setModal} />
    </div>
  );
}

function FilaReferido({
  referido: r,
  modo,
  abierto,
  onToggle,
  onEstado,
}: {
  referido: Referido;
  modo: boolean;
  abierto: boolean;
  onToggle: () => void;
  onEstado: (e: Referido["estado"]) => void;
}) {
  const dev = selectores.desarrollos().find((d) => d.nombre === r.desarrollos_interes[0]);

  return (
    <>
      <tr className="border-b border-border align-top">
        <td className="w-10 px-2 py-4">
          <button
            type="button"
            onClick={onToggle}
            aria-label={abierto ? "Contraer referido" : "Expandir referido"}
            className="rounded-md p-1 text-gris hover:bg-secondary"
          >
            {abierto ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-negro">{modo ? "••••••" : r.nombre}</span>
            {r.es_cliente && (
              <span className="rounded-full bg-verde-claro px-2 py-0.5 text-[11px] font-semibold text-verde-oscuro">
                Cliente
              </span>
            )}
          </div>
          {r.duplicado_crm && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-ambar-borde bg-ambar-claro px-2.5 py-1 text-[11px] font-semibold text-negro">
              <AlertTriangle className="size-3" />
              Ya registrado previamente — no genera atribución · {r.registro_original}
            </span>
          )}
        </td>
        <td className="px-4 py-4">
          <p className="text-negro">{modo ? "••••••" : r.correo}</p>
          <p className="num text-gris">{modo ? "••••••" : r.telefono}</p>
        </td>
        <td className="whitespace-nowrap px-4 py-4">
          <span
            className={cn(
              "inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold",
              r.origen === "LINK"
                ? "bg-verde-claro text-verde-oscuro"
                : "bg-secondary text-gris",
            )}
          >
            {r.origen === "LINK" ? "Por tu link" : "Captura manual"}
          </span>
        </td>
        <td className="px-4 py-4 font-semibold text-verde">
          {r.desarrollos_interes.join(" · ")}
        </td>
        <td className="px-4 py-4">
          <Select value={r.estado} onValueChange={(v) => onEstado(v as Referido["estado"])}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map((e) => (
                <SelectItem key={e.v} value={e.v}>
                  <span className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", e.color)} />
                    {e.l}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="num px-4 py-4 font-bold text-verde">
          {modo ? "••••••" : r.ganancia_potencial > 0 ? mxn(r.ganancia_potencial) : "—"}
        </td>
        <td className="px-4 py-4">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Ver detalle del referido"
            className="rounded-md p-1 text-gris hover:bg-secondary"
          >
            <Eye className="size-4" />
          </button>
        </td>
      </tr>

      {abierto && (
        <tr className="border-b border-border bg-secondary/40">
          <td colSpan={8} className="px-4 py-5">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="eyebrow text-gris">Actividad</p>
                <ol className="mt-3 space-y-3">
                  {r.actividad.map((a) => {
                    const Icon = ICONO_ACTIVIDAD[a.tipo];
                    return (
                      <li key={`${a.tipo}-${a.fecha}`} className="flex gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-verde-oscuro">
                          <Icon className="size-3.5" />
                        </span>
                        <div>
                          <p className="text-sm text-negro">{a.detalle}</p>
                          <p className="num text-xs text-gris">{a.fecha}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div>
                <p className="eyebrow text-gris">Cobro estimado</p>
                <div className="mt-3 rounded-xl bg-background p-4">
                  <LineaCobro
                    compacta
                    nodos={lineaDeCobro(
                      dev ?? selectores.desarrollos()[0]!,
                      r.estado === "con_compra" ? 4 : r.confirmado_en ? 2 : 1,
                    )}
                    {...(r.proteccion_hasta
                      ? {
                          nota: `Periodo de protección de atribución: 90 días desde la confirmación.`,
                        }
                      : {})}
                  />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ModalRegistro({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const agregar = usePortal((s) => s.agregarReferido);
  const referidos = usePortal((s) => s.referidos);

  const [busqueda, setBusqueda] = useState("");
  const [desarrollo, setDesarrollo] = useState("");
  const [tipoPersona, setTipoPersona] = useState<"FISICA" | "MORAL">("FISICA");
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rfc, setRfc] = useState("");
  const [curp, setCurp] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);

  const coincidencias = busqueda
    ? referidos.filter((r) => r.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : [];

  const valido =
    desarrollo !== "" && nombre.trim() !== "" && correo.includes("@") && telefono.length >= 10 && consentimiento;

  const guardar = () => {
    const duplicado = referidos.some(
      (r) => r.correo.toLowerCase() === correo.toLowerCase(),
    );
    agregar({
      id: `ref-${Date.now()}`,
      nombre,
      correo,
      telefono: `+52 ${telefono}`,
      tipo_persona: tipoPersona,
      rfc: rfc || null,
      curp: curp || null,
      origen: "MANUAL",
      desarrollos_interes: [desarrollo],
      estado: "pendiente_confirmacion",
      es_cliente: false,
      duplicado_crm: duplicado,
      registro_original: duplicado ? "registro previo en CRM" : null,
      confirmado_en: null,
      proteccion_hasta: null,
      ganancia_potencial: 0,
      actividad: [
        {
          tipo: "registro",
          fecha: new Date().toLocaleString("es-MX"),
          detalle: "Captura manual · doble opt-in enviado",
        },
      ],
      auditoria: {
        creado_en: new Date().toISOString(),
        creado_por: "usuario",
        actualizado_en: new Date().toISOString(),
        actualizado_por: "usuario",
        deprecado_en: null,
        deprecado_por: null,
        motivo: null,
      },
    });
    // SWAP POINT: servicio_doble_optin
    toast.success("Referido registrado. Enviamos la confirmación de datos.");
    onOpenChange(false);
    setNombre("");
    setCorreo("");
    setTelefono("");
    setRfc("");
    setCurp("");
    setConsentimiento(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar manualmente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>¿Ya lo tienes registrado? Búscalo para no duplicar</Label>
            <Input
              className="mt-2 focus-visible:border-verde"
              placeholder="Buscar por nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {coincidencias.length > 0 && (
              <div className="mt-2 rounded-lg border border-ambar-borde bg-ambar-claro p-3 text-xs text-negro">
                Coincidencias: {coincidencias.map((c) => c.nombre).join(", ")}
              </div>
            )}
          </div>

          <div>
            <Label>
              Desarrollos de Interés <span className="text-rojo">*</span>
            </Label>
            <Select value={desarrollo} onValueChange={setDesarrollo}>
              <SelectTrigger className="mt-2 w-full">
                <SelectValue placeholder="Selecciona un desarrollo" />
              </SelectTrigger>
              <SelectContent>
                {selectores.desarrollos().map((d) => (
                  <SelectItem key={d.id} value={d.nombre}>
                    {d.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>
              Tipo de Persona <span className="text-rojo">*</span>
            </Label>
            <div className="mt-2 inline-flex rounded-lg bg-secondary p-1">
              {(["FISICA", "MORAL"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipoPersona(t)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-xs font-semibold",
                    tipoPersona === t ? "bg-background text-negro" : "text-gris",
                  )}
                >
                  {t === "FISICA" ? "Física" : "Moral"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>
              Nombre Completo <span className="text-rojo">*</span>
            </Label>
            <Input
              className="mt-2"
              placeholder="Juan Pérez García"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>
                Email <span className="text-rojo">*</span>
              </Label>
              <Input
                className="mt-2"
                placeholder="juan.perez@correo.mx"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </div>
            <div>
              <Label>
                Teléfono <span className="text-rojo">*</span> (+52)
              </Label>
              <div className="mt-2 flex">
                <span className="flex items-center rounded-l-md border border-r-0 border-border bg-secondary px-3 text-xs font-semibold text-gris">
                  MX
                </span>
                <Input
                  className="rounded-l-none"
                  inputMode="tel"
                  placeholder="33 1234 5678"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>RFC</Label>
              <Input
                className="mt-2"
                placeholder="PEGJ850312H23"
                value={rfc}
                onChange={(e) => setRfc(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <Label>CURP</Label>
              <Input
                className="mt-2"
                placeholder="PEGJ850312HJCRRN08"
                value={curp}
                onChange={(e) => setCurp(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="rounded-xl bg-secondary p-4">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={consentimiento}
                onCheckedChange={(v) => setConsentimiento(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-negro">
                Confirmo que informé a esta persona y que autorizó su registro.
              </span>
            </label>
            <p className="mt-3 text-xs text-gris">
              Le enviaremos un mensaje para que confirme sus datos. Tu referido no queda activo
              hasta que confirme.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!valido} onClick={guardar}>
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
