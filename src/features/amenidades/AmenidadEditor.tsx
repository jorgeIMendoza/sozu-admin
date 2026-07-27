// =============================================================
// Portal Condominio · Amenidades — Editor de ficha (alta / edición)
// Secciones: Datos básicos · Media · Modalidad de uso · Config. de reserva.
// Libre ⇒ oculta la sección de reserva. Reservable ⇒ valida ≥1 franja + CLABE.
// Todo mock; media/CLABE/STP son // SWAP POINT.
// =============================================================
import { useEffect, useMemo, useState } from "react";
import {
  ImagePlus, Film, Star, Trash2, ChevronUp, ChevronDown, X, Plus, AlertCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAmenidadesStore, type AmenidadFormValues } from "./store";
import type { Amenidad, MediaItem, ModalidadUso, ModeloCobro, TipoAmenidad } from "./types";
import { TIPO_ICON, TIPO_LABEL, MODELO_COBRO_LABEL, MODELO_COBRO_AYUDA } from "./ui";

const TIPOS: TipoAmenidad[] = [
  "sala_juntas", "sala_tv", "asador", "cocina_equipada", "gimnasio", "lobby",
  "roof_garden", "sky_bar", "sala_juegos", "coworking", "area_comercial", "parque", "otro",
];
const MODELOS: ModeloCobro[] = ["gratuito", "por_franja", "por_uso", "por_hora"];
const FRANJA_RE = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;
const PH = "/placeholder.svg";

function nuevoId() {
  return `m-${Date.now()}-${Math.round(Math.random() * 1e5)}`;
}

interface FormState {
  nombre: string;
  tipo: TipoAmenidad;
  ubicacion: string;
  descripcion: string;
  media: MediaItem[];
  modalidadUso: ModalidadUso;
  // reserva (solo relevante si reservable)
  modeloCobro: ModeloCobro;
  tarifa: number;
  depositoGarantia: number;
  franjasHorarias: string[];
  capacidad: number;
  clabeStp: string;
  requiereValidacionAdmin: boolean;
  umbralMorosidadDias: number | null;
}

function estadoInicial(a: Amenidad | null): FormState {
  if (a) {
    return {
      nombre: a.nombre,
      tipo: a.tipo,
      ubicacion: a.ubicacion,
      descripcion: a.descripcion,
      media: structuredClone(a.media),
      modalidadUso: a.modalidadUso,
      modeloCobro: a.reserva?.modeloCobro ?? "por_uso",
      tarifa: a.reserva?.tarifa ?? 0,
      depositoGarantia: a.reserva?.depositoGarantia ?? 0,
      franjasHorarias: a.reserva?.franjasHorarias ?? [],
      capacidad: a.reserva?.capacidad ?? 1,
      clabeStp: a.reserva?.clabeStp ?? "",
      requiereValidacionAdmin: a.reserva?.requiereValidacionAdmin ?? true,
      umbralMorosidadDias: a.reserva?.umbralMorosidadDias ?? 30,
    };
  }
  return {
    nombre: "", tipo: "otro", ubicacion: "", descripcion: "", media: [],
    modalidadUso: "libre",
    modeloCobro: "por_uso", tarifa: 0, depositoGarantia: 0, franjasHorarias: [],
    capacidad: 1, clabeStp: "", requiereValidacionAdmin: true, umbralMorosidadDias: 30,
  };
}

export function AmenidadEditor({
  open,
  amenidad,
  onClose,
}: {
  open: boolean;
  amenidad: Amenidad | null;
  onClose: () => void;
}) {
  const crearAmenidad = useAmenidadesStore((s) => s.crearAmenidad);
  const editarAmenidad = useAmenidadesStore((s) => s.editarAmenidad);
  const [f, setF] = useState<FormState>(() => estadoInicial(amenidad));
  const [franjaInput, setFranjaInput] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  // Rehidrata el formulario cada vez que se abre con otra amenidad.
  useEffect(() => {
    if (open) {
      setF(estadoInicial(amenidad));
      setFranjaInput("");
      setMediaUrl("");
      setIntentoGuardar(false);
    }
  }, [open, amenidad]);

  const esReservable = f.modalidadUso === "reservable";
  const esGratuito = f.modeloCobro === "gratuito";

  const errores = useMemo(() => {
    const e: string[] = [];
    if (!f.nombre.trim()) e.push("El nombre es obligatorio.");
    if (esReservable) {
      if (f.franjasHorarias.length === 0) e.push("Una amenidad reservable necesita al menos una franja horaria.");
      if (!f.clabeStp.trim()) e.push("Una amenidad reservable necesita una CLABE STP.");
      if (f.capacidad < 1) e.push("La capacidad debe ser al menos 1.");
    }
    return e;
  }, [f, esReservable]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((prev) => ({ ...prev, [k]: v }));

  // ── Media ──────────────────────────────────────────────
  const addMedia = (tipo: MediaItem["tipo"], url: string) => {
    const clean = url.trim() || PH;
    setF((prev) => {
      const esPrimeraImagen = tipo === "imagen" && !prev.media.some((m) => m.tipo === "imagen");
      const item: MediaItem = {
        id: nuevoId(),
        tipo,
        url: clean,
        orden: prev.media.length,
        esPortada: esPrimeraImagen, // primera imagen = portada por defecto
      };
      return { ...prev, media: [...prev.media, item] };
    });
    setMediaUrl("");
  };
  const removeMedia = (id: string) =>
    setF((prev) => {
      const media = prev.media.filter((m) => m.id !== id).map((m, i) => ({ ...m, orden: i }));
      // Si se borró la portada, promueve la primera imagen restante.
      if (!media.some((m) => m.esPortada)) {
        const firstImg = media.find((m) => m.tipo === "imagen");
        if (firstImg) firstImg.esPortada = true;
      }
      return { ...prev, media };
    });
  const moverMedia = (id: string, dir: -1 | 1) =>
    setF((prev) => {
      const idx = prev.media.findIndex((m) => m.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.media.length) return prev;
      const media = [...prev.media];
      [media[idx], media[j]] = [media[j], media[idx]];
      return { ...prev, media: media.map((m, i) => ({ ...m, orden: i })) };
    });
  const marcarPortada = (id: string) =>
    setF((prev) => ({
      ...prev,
      media: prev.media.map((m) => ({ ...m, esPortada: m.id === id && m.tipo === "imagen" })),
    }));

  // ── Franjas ────────────────────────────────────────────
  const addFranja = () => {
    const val = franjaInput.trim();
    if (!FRANJA_RE.test(val)) return;
    if (f.franjasHorarias.includes(val)) { setFranjaInput(""); return; }
    set("franjasHorarias", [...f.franjasHorarias, val].sort());
    setFranjaInput("");
  };
  const removeFranja = (fr: string) => set("franjasHorarias", f.franjasHorarias.filter((x) => x !== fr));

  const guardar = () => {
    setIntentoGuardar(true);
    if (errores.length > 0) return;
    const values: AmenidadFormValues = {
      nombre: f.nombre.trim(),
      tipo: f.tipo,
      ubicacion: f.ubicacion.trim(),
      descripcion: f.descripcion.trim(),
      media: f.media,
      modalidadUso: f.modalidadUso,
      reserva: esReservable
        ? {
            modeloCobro: f.modeloCobro,
            tarifa: esGratuito ? 0 : f.tarifa,
            depositoGarantia: esGratuito ? 0 : f.depositoGarantia,
            franjasHorarias: f.franjasHorarias,
            capacidad: f.capacidad,
            clabeStp: f.clabeStp.trim(),
            requiereValidacionAdmin: f.requiereValidacionAdmin,
            umbralMorosidadDias: f.umbralMorosidadDias,
          }
        : null,
    };
    if (amenidad) editarAmenidad(amenidad.id, values);
    else crearAmenidad(values);
    onClose();
  };

  const TipoIcon = TIPO_ICON[f.tipo];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TipoIcon className="h-5 w-5 text-primary" />
            {amenidad ? "Editar amenidad" : "Nueva amenidad"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* ── Datos básicos ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Datos básicos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="am-nombre">Nombre *</Label>
                <Input id="am-nombre" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej. Sala de Juntas 1" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="am-tipo">Tipo</Label>
                <select
                  id="am-tipo"
                  value={f.tipo}
                  onChange={(e) => set("tipo", e.target.value as TipoAmenidad)}
                  className="h-9 w-full px-3 rounded-md border border-border bg-background text-sm"
                >
                  {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="am-ubic">Ubicación</Label>
              <Input id="am-ubic" value={f.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} placeholder="Ej. Torre A · Piso 2" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="am-desc">Descripción</Label>
              <Textarea id="am-desc" rows={3} value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Describe la amenidad…" />
            </div>
          </section>

          {/* ── Media ── */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Galería</h3>
              <p className="text-xs text-muted-foreground">
                Imágenes y video. Marca una imagen como portada. {/* SWAP POINT: subida real a Supabase Storage con límites de tamaño/formato. */}
              </p>
            </div>

            {f.media.length > 0 && (
              <div className="space-y-2">
                {f.media.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
                    <div className="h-12 w-16 shrink-0 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                      {m.tipo === "imagen" ? (
                        <img src={m.url} alt={m.titulo ?? ""} className="h-full w-full object-cover" />
                      ) : (
                        <Film className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{m.tipo === "imagen" ? "Imagen" : "Video"}{m.esPortada && " · portada"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{m.url}</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => moverMedia(m.id, -1)} title="Subir">
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={i === f.media.length - 1} onClick={() => moverMedia(m.id, 1)} title="Bajar">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button" size="icon" variant="ghost"
                        className={cn("h-7 w-7", m.esPortada && "text-primary")}
                        disabled={m.tipo !== "imagen"}
                        onClick={() => marcarPortada(m.id)}
                        title={m.tipo === "imagen" ? "Marcar portada" : "Solo imágenes pueden ser portada"}
                      >
                        <Star className={cn("h-4 w-4", m.esPortada && "fill-current")} />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeMedia(m.id)} title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="URL de imagen/video (opcional en mock)"
                className="h-9 flex-1 min-w-[200px]"
              />
              <Button type="button" size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => addMedia("imagen", mediaUrl)}>
                <ImagePlus className="h-4 w-4" /> Imagen
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => addMedia("video", mediaUrl)}>
                <Film className="h-4 w-4" /> Video
              </Button>
            </div>
          </section>

          {/* ── Modalidad de uso ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Modalidad de uso</h3>
            <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
              {(["libre", "reservable"] as ModalidadUso[]).map((mod) => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => set("modalidadUso", mod)}
                  className={cn(
                    "px-3 py-1.5 rounded-md font-medium transition-colors",
                    f.modalidadUso === mod ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mod === "libre" ? "Uso libre" : "Reservable"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {esReservable
                ? "Aparece en el motor de reservas (calendario, bandejas, pago) y en el catálogo."
                : "Solo catálogo promocional. Sin calendario, franjas, precio ni pago."}
            </p>
          </section>

          {/* ── Configuración de reserva (solo reservable) ── */}
          {esReservable && (
            <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <h3 className="text-sm font-semibold text-foreground">Configuración de reserva</h3>

              <div className="space-y-1">
                <Label htmlFor="am-cobro">Modelo de cobro</Label>
                <select
                  id="am-cobro"
                  value={f.modeloCobro}
                  onChange={(e) => set("modeloCobro", e.target.value as ModeloCobro)}
                  className="h-9 w-full px-3 rounded-md border border-border bg-background text-sm"
                >
                  {MODELOS.map((m) => <option key={m} value={m}>{MODELO_COBRO_LABEL[m]}</option>)}
                </select>
                <p className="text-[11px] text-muted-foreground">{MODELO_COBRO_AYUDA[f.modeloCobro]}</p>
              </div>

              {!esGratuito && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="am-tarifa">Tarifa (MXN)</Label>
                    <Input id="am-tarifa" type="number" min={0} className="tabular-nums" value={f.tarifa}
                      onChange={(e) => set("tarifa", Math.max(0, Number(e.target.value) || 0))} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="am-dep">Depósito de garantía (MXN)</Label>
                    <Input id="am-dep" type="number" min={0} className="tabular-nums" value={f.depositoGarantia}
                      onChange={(e) => set("depositoGarantia", Math.max(0, Number(e.target.value) || 0))} />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label>Franjas horarias *</Label>
                {f.franjasHorarias.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {f.franjasHorarias.map((fr) => (
                      <span key={fr} className="inline-flex items-center gap-1 rounded-md bg-background border border-border px-2 py-0.5 text-xs tabular-nums">
                        {fr}
                        <button type="button" onClick={() => removeFranja(fr)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    value={franjaInput}
                    onChange={(e) => setFranjaInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFranja(); } }}
                    placeholder="08:00-12:00"
                    className="h-9 w-40 tabular-nums"
                  />
                  <Button type="button" size="sm" variant="outline" className="h-9 gap-1" onClick={addFranja} disabled={!FRANJA_RE.test(franjaInput.trim())}>
                    <Plus className="h-4 w-4" /> Agregar franja
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Formato HH:MM-HH:MM (bloques, no por minuto).</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="am-cap">Capacidad</Label>
                  <Input id="am-cap" type="number" min={1} className="tabular-nums" value={f.capacidad}
                    onChange={(e) => set("capacidad", Math.max(1, Number(e.target.value) || 1))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="am-clabe">CLABE STP *</Label>
                  <Input id="am-clabe" className="tabular-nums" value={f.clabeStp} maxLength={18}
                    onChange={(e) => set("clabeStp", e.target.value.replace(/\D/g, ""))}
                    placeholder="18 dígitos" />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div>
                  <Label htmlFor="am-valida" className="cursor-pointer">Requiere validación de administración</Label>
                  <p className="text-[11px] text-muted-foreground">La solicitud pasa por revisión antes de habilitar el pago.</p>
                </div>
                <Switch id="am-valida" checked={f.requiereValidacionAdmin} onCheckedChange={(v) => set("requiereValidacionAdmin", v)} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="am-mora">Umbral de morosidad (días, opcional)</Label>
                <Input
                  id="am-mora" type="number" min={0} className="tabular-nums w-40"
                  value={f.umbralMorosidadDias ?? ""}
                  onChange={(e) => set("umbralMorosidadDias", e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0))}
                  placeholder="Sin umbral"
                />
              </div>
            </section>
          )}

          {intentoGuardar && errores.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1">
              {errores.map((e) => (
                <p key={e} className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {e}
                </p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={intentoGuardar && errores.length > 0}>
            {amenidad ? "Guardar cambios" : "Crear amenidad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
