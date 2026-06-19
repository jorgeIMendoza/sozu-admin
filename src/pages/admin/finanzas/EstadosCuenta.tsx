import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  X,
  Loader2,
  FileSearch,
  Building2,
  Landmark,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// ─── FilterAutocomplete ────────────────────────────────────────────────────────

interface FilterAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  className?: string;
}

function FilterAutocomplete({ value, onChange, options, placeholder, className }: FilterAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 8);
  }, [value, options]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const showDropdown = open && matches.length > 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="h-9 text-sm pr-7"
      />
      {value && (
        <button
          onClick={() => { onChange(""); setOpen(false); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
      {showDropdown && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-md border border-border bg-popover shadow-md overflow-hidden">
          <div className="max-h-[200px] overflow-y-auto">
            {matches.map((opt) => (
              <button
                key={opt}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                  value === opt && "bg-accent/50 font-medium"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ITEMS_PER_PAGE = 10;

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface Proyecto {
  id: number;
  nombre: string;
}

interface Banco {
  id: number;
  nombre: string;
}

interface CuentaSozu {
  id: number;
  alias: string;
  id_banco: number;
  numero_cuenta?: string;
  clabe?: string;
}

interface EstadoCuenta {
  id: number;
  anio: number;
  mes: number;
  proyecto: string;
  banco: string;
  cuenta: string;        // alias de cuentas_sozu
  numero_cuenta: string;
  fecha_subida: string;
  archivo_url: string;   // url_estado_cuenta en BD
}


// ─── DB Hooks ──────────────────────────────────────────────────────────────────

const STORAGE_BASE = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/estados_cuenta`
  : "";

function useProyectosSozu() {
  return useQuery<Proyecto[]>({
    queryKey: ["proyectos-sozu-publicados"],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data: er } = await supabase
        .from("entidades_relacionadas")
        .select("id_proyecto")
        .eq("id_tipo_entidad", 5)
        .eq("activo", true);

      const ids = [...new Set((er ?? []).map(r => r.id_proyecto).filter(Boolean))] as number[];
      if (!ids.length) return [];

      const { data: proyectos } = await supabase
        .from("proyectos")
        .select("id, nombre")
        .in("id", ids)
        .eq("publicar", true)
        .eq("activo", true)
        .order("nombre");

      return (proyectos ?? []) as Proyecto[];
    },
  });
}

function useBancos() {
  return useQuery<Banco[]>({
    queryKey: ["bancos-activos"],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data } = await supabase
        .from("bancos")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre");
      return (data ?? []) as Banco[];
    },
  });
}

function useCuentasSozu() {
  return useQuery<CuentaSozu[]>({
    queryKey: ["cuentas-sozu-activas"],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const probe = await (supabase as any).from("cuentas_sozu").select("id").limit(0);
      if (probe.error) return [];
      const { data } = await (supabase as any)
        .from("cuentas_sozu")
        .select("id, alias, id_banco, numero_cuenta, clabe")
        .eq("activo", true)
        .order("alias");
      return (data ?? []) as CuentaSozu[];
    },
  });
}

function useEstadosCuenta() {
  return useQuery<EstadoCuenta[]>({
    queryKey: ["estados-cuenta"],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data: ec } = await (supabase as any)
        .from("estados_cuenta")
        .select("id, id_proyecto, id_cuenta_sozu, anio, mes, url_estado_cuenta, nombre_archivo, fecha_creacion")
        .eq("activo", true)
        .order("anio", { ascending: false })
        .order("mes", { ascending: false });

      if (!ec?.length) return [];

      const cuentaIds = [...new Set(ec.map((r: any) => r.id_cuenta_sozu))] as number[];
      const { data: cuentas } = await (supabase as any)
        .from("cuentas_sozu")
        .select("id, alias, id_banco, numero_cuenta, clabe")
        .in("id", cuentaIds);

      const cuentaMap: Record<number, any> = Object.fromEntries(
        (cuentas ?? []).map((c: any) => [c.id, c])
      );

      const bancoIds = [...new Set((cuentas ?? []).map((c: any) => c.id_banco))] as number[];
      const { data: bancos } = bancoIds.length
        ? await supabase.from("bancos").select("id, nombre").in("id", bancoIds)
        : { data: [] };
      const bancoMap: Record<number, string> = Object.fromEntries(
        (bancos ?? []).map((b: any) => [b.id, b.nombre])
      );

      const proyIds = [...new Set(ec.map((r: any) => r.id_proyecto))] as number[];
      const { data: proyectos } = proyIds.length
        ? await supabase.from("proyectos").select("id, nombre").in("id", proyIds)
        : { data: [] };
      const proyMap: Record<number, string> = Object.fromEntries(
        (proyectos ?? []).map((p: any) => [p.id, p.nombre])
      );

      return ec.map((r: any): EstadoCuenta => {
        const cuenta = cuentaMap[r.id_cuenta_sozu] ?? {};
        const urlFull = r.url_estado_cuenta?.startsWith("http")
          ? r.url_estado_cuenta
          : `${STORAGE_BASE}/${r.url_estado_cuenta}`;
        return {
          id: r.id,
          anio: r.anio,
          mes: r.mes,
          proyecto: proyMap[r.id_proyecto] ?? String(r.id_proyecto),
          banco: bancoMap[cuenta.id_banco] ?? "",
          cuenta: cuenta.alias ?? "",
          numero_cuenta: cuenta.numero_cuenta ?? cuenta.clabe ?? "",
          fecha_subida: r.fecha_creacion?.slice(0, 10) ?? "",
          archivo_url: urlFull,
        };
      });
    },
  });
}

// ─── Upload Dialog ─────────────────────────────────────────────────────────────

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  proyectos: Proyecto[];
  bancos: Banco[];
  cuentasSozu: CuentaSozu[];
  userEmail: string | null;
}

const slugify = (s: string) =>
  s.normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

function UploadDialog({ open, onClose, proyectos, bancos, cuentasSozu, userEmail }: UploadDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [anio, setAnio] = useState("");
  const [mes, setMes] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [filterBancoId, setFilterBancoId] = useState("all");
  const [cuentaSozuId, setCuentaSozuId] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const bancoNombreMap = useMemo(
    () => Object.fromEntries(bancos.map((b) => [b.id, b.nombre])),
    [bancos]
  );

  const cuentasFiltradas = cuentasSozu.filter(
    (c) => filterBancoId === "all" || c.id_banco === Number(filterBancoId)
  );

  const reset = () => {
    setAnio(""); setMes(""); setProyectoId(""); setFilterBancoId("all"); setCuentaSozuId(""); setArchivo(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const valid = anio && mes && proyectoId && cuentaSozuId && archivo;

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!archivo || !proyectoId || !cuentaSozuId || !anio || !mes) throw new Error("Datos incompletos");

      const proyecto = proyectos.find(p => String(p.id) === proyectoId);
      const cuenta = cuentasSozu.find(c => String(c.id) === cuentaSozuId);
      if (!proyecto || !cuenta) throw new Error("Proyecto o cuenta no encontrado");

      const bancoNombre = bancoNombreMap[cuenta.id_banco] ?? "banco";
      const ruta = `${slugify(proyecto.nombre)}/${slugify(bancoNombre)}/${cuenta.alias}/${anio}/${archivo.name}`;

      const { error: uploadError } = await supabase.storage
        .from("estados_cuenta")
        .upload(ruta, archivo, { upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      const { error: insertError } = await (supabase as any).from("estados_cuenta").insert({
        id_proyecto: Number(proyectoId),
        id_cuenta_sozu: Number(cuentaSozuId),
        anio: Number(anio),
        mes: Number(mes),
        url_estado_cuenta: ruta,
        nombre_archivo: archivo.name,
        subido_por: userEmail,
      });

      if (insertError) throw new Error(insertError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estados-cuenta"] });
      toast({ title: "Estado de cuenta subido", description: "El archivo se subio correctamente." });
      handleClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error al subir", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Upload className="size-4 text-muted-foreground" />
            Subir Estado de Cuenta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Año + Mes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Año <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                placeholder="ej. 2025"
                min={2020}
                max={2030}
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Mes <span className="text-destructive">*</span></Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent className="max-h-[190px] overflow-y-auto">
                  {MESES.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Proyecto */}
          <div className="space-y-1.5">
            <Label className="text-[13px]">Proyecto <span className="text-destructive">*</span></Label>
            <Select value={proyectoId} onValueChange={setProyectoId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Seleccionar proyecto" />
              </SelectTrigger>
              <SelectContent className="max-h-[190px] overflow-y-auto">
                {proyectos.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro banco (opcional) + Cuenta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Filtrar por banco</Label>
              <Select value={filterBancoId} onValueChange={(v) => { setFilterBancoId(v); setCuentaSozuId(""); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="max-h-[190px] overflow-y-auto">
                  <SelectItem value="all">Todos</SelectItem>
                  {bancos.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Cuenta <span className="text-destructive">*</span></Label>
              <Select value={cuentaSozuId} onValueChange={setCuentaSozuId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent className="max-h-[190px] overflow-y-auto">
                  {cuentasFiltradas.length === 0 ? (
                    <div className="px-3 py-2 text-[12px] text-muted-foreground">
                      Sin cuentas para este banco
                    </div>
                  ) : (
                    cuentasFiltradas.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {bancoNombreMap[c.id_banco] ?? "?"} - {c.alias}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File Drop Zone */}
          <div className="space-y-1.5">
            <Label className="text-[13px]">Archivo <span className="text-destructive">*</span></Label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) setArchivo(f);
              }}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                dragOver ? "border-primary/50 bg-primary/5"
                : archivo ? "border-emerald-300 bg-emerald-50/50"
                : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
              )}
              onClick={() => document.getElementById("ec-file-input")?.click()}
            >
              <input
                id="ec-file-input"
                type="file"
                accept=".pdf,.xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setArchivo(f);
                }}
              />
              {archivo ? (
                <div className="flex items-center justify-center gap-2 text-emerald-700">
                  <FileText className="size-4 shrink-0" />
                  <span className="text-sm font-medium truncate max-w-xs">{archivo.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setArchivo(null); }}
                    className="ml-1 text-muted-foreground/60 hover:text-destructive transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="text-muted-foreground space-y-1">
                  <Upload className="size-7 mx-auto text-muted-foreground/50" />
                  <p className="text-sm">Arrastra aqui o <span className="text-primary underline underline-offset-2">selecciona</span></p>
                  <p className="text-[11px] text-muted-foreground/60">PDF, Excel o CSV</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={uploadMutation.isPending}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!valid || uploadMutation.isPending}
            className="gap-1.5"
            onClick={() => uploadMutation.mutate()}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {uploadMutation.isPending ? "Subiendo..." : "Subir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Document Viewer Dialog ────────────────────────────────────────────────────

interface ViewerDialogProps {
  row: EstadoCuenta | null;
  onClose: () => void;
}

function ViewerDialog({ row, onClose }: ViewerDialogProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleOpenChange = (o: boolean) => {
    if (!o) { setLoaded(false); setError(false); onClose(); }
  };

  if (!row) return null;

  return (
    <Dialog open={!!row} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b shrink-0 bg-card">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex items-center justify-center size-8 rounded-md bg-muted shrink-0">
                <FileText className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold leading-tight truncate">
                  {row.proyecto}
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {MESES[row.mes - 1]} {row.anio} - {row.banco} - <span className="font-mono">{row.cuenta}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="tabular-nums text-[11px] h-6 px-2">
                {String(row.mes).padStart(2, "0")}/{row.anio}
              </Badge>
              <a
                href={row.archivo_url}
                download
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                <FileText className="size-3.5" />
                Descargar
              </a>
              <a
                href={row.archivo_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium border hover:bg-muted transition-colors"
              >
                Abrir en pestana
              </a>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
            <span>Subido el {row.fecha_subida}</span>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-muted/30 relative">
          {!loaded && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
              <Loader2 className="size-7 animate-spin text-muted-foreground" />
              <p className="text-[12px] text-muted-foreground">Cargando estado de cuenta...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
              <FileText className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No se pudo cargar el documento.</p>
              <a
                href={row.archivo_url}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-primary underline"
              >
                Abrir en pestana
              </a>
            </div>
          )}
          <iframe
            key={row.id}
            src={row.archivo_url}
            className={cn("w-full h-full border-0 transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
            title={`Estado de cuenta ${MESES[row.mes - 1]} ${row.anio}`}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit URL Dialog ───────────────────────────────────────────────────────────

interface EditUrlDialogProps {
  row: EstadoCuenta | null;
  onClose: () => void;
}

function EditUrlDialog({ row, onClose }: EditUrlDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (row) setUrl(row.archivo_url);
  }, [row]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ruta = url.trim().startsWith("http")
        ? url.trim().replace(/.*\/estados_cuenta\//, "")
        : url.trim();
      const { error } = await (supabase as any)
        .from("estados_cuenta")
        .update({ url_estado_cuenta: ruta })
        .eq("id", row!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estados-cuenta"] });
      toast({ title: "URL actualizada" });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    },
  });

  if (!row) return null;

  return (
    <Dialog open={!!row} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Pencil className="size-4 text-muted-foreground" />
            Actualizar URL
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-[12px] text-muted-foreground">
            {row.proyecto} - {MESES[row.mes - 1]} {row.anio} - <span className="font-mono">{row.cuenta}</span>
          </p>
          <div className="space-y-1.5">
            <Label className="text-[13px]">URL del archivo (url_estado_cuenta)</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://... o ruta relativa en bucket"
              className="h-9 text-sm font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Ruta bucket: estados_cuenta/proyecto/banco/alias/anio/archivo.pdf
            </p>
          </div>
        </div>
        <Separator />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saveMutation.isPending}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!url.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function EstadosCuenta() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.rol_id === 1;
  const userEmail = profile?.email ?? null;

  const { data: proyectos = [] } = useProyectosSozu();
  const { data: bancos = [] } = useBancos();
  const { data: cuentasSozu = [] } = useCuentasSozu();
  const { data: estadosCuenta = [], isLoading: loadingEC } = useEstadosCuenta();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewRow, setViewRow] = useState<EstadoCuenta | null>(null);
  const [editUrlRow, setEditUrlRow] = useState<EstadoCuenta | null>(null);

  const [searchAnio, setSearchAnio] = useState("");
  const [filterMes, setFilterMes] = useState<string>("all");
  const [searchProyecto, setSearchProyecto] = useState("");
  const [searchBanco, setSearchBanco] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const resetPage = () => setCurrentPage(1);

  const filtered = useMemo(() => {
    return estadosCuenta.filter((r) => {
      if (searchAnio && !String(r.anio).includes(searchAnio.trim())) return false;
      if (filterMes !== "all" && String(r.mes) !== filterMes) return false;
      if (searchProyecto && !r.proyecto.toLowerCase().includes(searchProyecto.toLowerCase())) return false;
      if (searchBanco && !r.banco.toLowerCase().includes(searchBanco.toLowerCase())) return false;
      return true;
    });
  }, [estadosCuenta, searchAnio, filterMes, searchProyecto, searchBanco]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const hasFilters = searchAnio || filterMes !== "all" || searchProyecto || searchBanco;

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  const totalRegistros = estadosCuenta.length;
  const proyectosUnicos = new Set(estadosCuenta.map((r) => r.proyecto)).size;
  const aniosUnicos = new Set(estadosCuenta.map((r) => r.anio)).size;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estados de Cuenta</h1>
          <p className="text-muted-foreground mt-1">
            Gestion centralizada de estados de cuenta bancarios por proyecto
          </p>
        </div>
        {isSuperAdmin && (
          <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5 shrink-0">
            <Upload className="size-3.5" />
            Subir estado de cuenta
          </Button>
        )}
      </div>

      {/* Banner sin cuentas configuradas */}
      {isSuperAdmin && cuentasSozu.length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Landmark className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Sin cuentas bancarias configuradas</p>
            <p className="text-[12px] mt-0.5 text-amber-700">
              Inserta registros en <span className="font-mono">cuentas_sozu</span> (banco + alias) para habilitar la subida de archivos.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileSearch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{totalRegistros}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proyectos</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{proyectosUnicos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anos con registros</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{aniosUnicos}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          type="number"
          placeholder="Ano"
          value={searchAnio}
          onChange={(e) => { setSearchAnio(e.target.value); resetPage(); }}
          className="h-9 text-sm w-[100px]"
          min={2020}
          max={2030}
        />
        <Select value={filterMes} onValueChange={(v) => { setFilterMes(v); resetPage(); }}>
          <SelectTrigger className="h-9 w-[140px] text-sm">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent className="max-h-[190px] overflow-y-auto">
            <SelectItem value="all">Todos los meses</SelectItem>
            {MESES.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FilterAutocomplete
          value={searchProyecto}
          onChange={(v) => { setSearchProyecto(v); resetPage(); }}
          options={proyectos.map((p) => p.nombre)}
          placeholder="Proyecto"
          className="w-[180px] sm:w-[200px]"
        />
        <FilterAutocomplete
          value={searchBanco}
          onChange={(v) => { setSearchBanco(v); resetPage(); }}
          options={bancos.map((b) => b.nombre)}
          placeholder="Banco"
          className="w-[140px] sm:w-[160px]"
        />
        {hasFilters && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1 text-muted-foreground"
            onClick={() => {
              setSearchAnio(""); setFilterMes("all");
              setSearchProyecto(""); setSearchBanco("");
              resetPage();
            }}
          >
            <X className="size-3.5" />
            Limpiar
          </Button>
        )}
        <p className="text-sm text-muted-foreground tabular-nums ml-auto hidden sm:block">
          {`${filtered.length} de ${totalRegistros} - Pag. ${safePage}/${totalPages}`}
        </p>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[70px]">Ano</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[110px]">Mes</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proyecto</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Banco</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Cuenta</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Fecha</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center w-[100px]">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingEC ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="size-5 animate-spin text-muted-foreground mx-auto" />
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    {hasFilters
                      ? "Sin resultados para los filtros actuales"
                      : "Sin estados de cuenta registrados"}
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/30 text-sm">
                    <TableCell className="tabular-nums text-muted-foreground">
                      {row.anio}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {MESES[row.mes - 1]}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground">{row.proyecto}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {row.banco}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="font-mono text-[12px]">{row.cuenta}</span>
                      <span className="block font-mono text-[10px] text-muted-foreground">{row.numero_cuenta}</span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-[11px] text-muted-foreground tabular-nums">
                      {row.fecha_subida}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewRow(row)}
                          title="Ver estado de cuenta"
                          className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <FileText className="size-4" />
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => setEditUrlRow(row)}
                            title="Actualizar URL"
                            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-center gap-1 px-4 py-3 border-t bg-muted/20">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={safePage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              &#8249;
            </Button>
            {pageNumbers.map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className="px-1 text-muted-foreground text-sm">...</span>
              ) : (
                <Button
                  key={p}
                  variant={p === safePage ? "default" : "outline"}
                  size="icon"
                  className="size-8 text-xs"
                  onClick={() => setCurrentPage(p as number)}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              &#8250;
            </Button>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        proyectos={proyectos}
        bancos={bancos}
        cuentasSozu={cuentasSozu}
        userEmail={userEmail}
      />
      <ViewerDialog row={viewRow} onClose={() => setViewRow(null)} />
      <EditUrlDialog row={editUrlRow} onClose={() => setEditUrlRow(null)} />
    </div>
  );
}
