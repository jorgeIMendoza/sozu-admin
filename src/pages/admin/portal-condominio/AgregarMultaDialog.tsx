import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, X } from "lucide-react";
import type { UnidadCondominio } from "@/types/condominio";

/**
 * Catálogo del tipo de multa / pago extra. Si se requiere agregar más
 * tipos en el futuro, basta con ampliar este array.
 */
const TIPOS = [
  "Estacionarse en lugar indebido",
  "Pago tardío",
  "Tarjeta de acceso extra",
  "Tirar basura en lugar indebido",
  "Uso indebido de instalaciones",
  "Violación al reglamento",
] as const;

type Tipo = (typeof TIPOS)[number];

const CONCEPTO_MANTENIMIENTO = 11;

export function AgregarMultaDialog({
  open,
  onOpenChange,
  unidades,
  proyectoId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unidades: UnidadCondominio[];
  proyectoId: number | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [idUnidad, setIdUnidad] = useState<string>("");
  const [tipo, setTipo] = useState<Tipo | "">("");
  const [monto, setMonto] = useState<string>("");
  const [descripcion, setDescripcion] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset al abrir/cerrar.
  useEffect(() => {
    if (!open) {
      setIdUnidad("");
      setTipo("");
      setMonto("");
      setDescripcion("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  const unidadesOrdenadas = useMemo(
    () => [...unidades].sort((a, b) => a.numero.localeCompare(b.numero, "es", { numeric: true })),
    [unidades],
  );

  const montoNum = Number(monto);
  const formValido =
    !!idUnidad &&
    !!tipo &&
    montoNum > 0 &&
    Number.isFinite(montoNum) &&
    descripcion.trim().length > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const unidad = unidades.find((u) => u.id === idUnidad);
      if (!unidad) throw new Error("Unidad no seleccionada");

      // 1) Resolver el acuerdo_pago de mantenimiento más reciente para esta
      //    cuenta — la multa se ancla a un acuerdo del calendario mensual.
      const { data: acuerdoRow, error: acErr } = await (supabase as any)
        .from("acuerdos_pago")
        .select("id")
        .eq("id_cuenta_cobranza", unidad.cuentaMantId)
        .eq("id_concepto", CONCEPTO_MANTENIMIENTO)
        .eq("activo", true)
        .order("fecha_pago", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (acErr) throw acErr;
      if (!acuerdoRow?.id) {
        throw new Error(
          "No se encontró un acuerdo de mantenimiento activo en esta cuenta para anclar la multa.",
        );
      }
      const idAcuerdo = acuerdoRow.id as number;

      // 2) Subir comprobante (opcional) y construir descripción final.
      let urlComprobante: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const fileName = `multa_cm_${unidad.cuentaMantId}_${Date.now()}.${ext}`;
        const { error: upErr } = await (supabase as any).storage
          .from("documentos")
          .upload(fileName, file);
        if (upErr) throw upErr;
        const { data: urlData } = (supabase as any).storage
          .from("documentos")
          .getPublicUrl(fileName);
        urlComprobante = urlData?.publicUrl ?? null;
      }

      const descripcionFinal = [
        `[${tipo}] ${descripcion.trim()}`,
        urlComprobante ? `| Comprobante: ${urlComprobante}` : null,
      ]
        .filter(Boolean)
        .join(" ");

      // 3) INSERT en multas. Pasamos fecha_creacion explícitamente para
      //    evitar cualquier discrepancia entre el reloj del cliente y el
      //    default CURRENT_TIMESTAMP de la BD, y para garantizar que la
      //    multa se inserte con la fecha del momento de registro.
      const nowIso = new Date().toISOString();
      const { error: insErr } = await (supabase as any).from("multas").insert({
        id_acuerdo_pago: idAcuerdo,
        monto: montoNum,
        descripcion: descripcionFinal,
        activo: true,
        fecha_creacion: nowIso,
        fecha_actualizacion: nowIso,
      });
      if (insErr) throw insErr;
    },
    onSuccess: async () => {
      toast({
        title: "Multa registrada",
        description: "Se agregó al cargo de mantenimiento de la unidad.",
      });
      // Forzamos refetch inmediato del dataset para que Cargos /
      // Departamentos / Cobranza muestren la nueva multa sin esperar el
      // siguiente ciclo de stale time.
      await queryClient.refetchQueries({ queryKey: ["condominio-dataset", proyectoId] });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Error al registrar la multa",
        description: pgErrorMessage(err) ?? "No se pudo guardar la multa.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Agregar multa o pago extra</DialogTitle>
          <DialogDescription>
            Se vincula al acuerdo de mantenimiento activo de la cuenta seleccionada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Unidad */}
          <div className="space-y-1.5">
            <Label htmlFor="unidad" className="text-[12px]">
              Propiedad / ID Cuenta Mantenimiento
            </Label>
            <Select value={idUnidad} onValueChange={setIdUnidad}>
              <SelectTrigger id="unidad" className="h-9 text-[13px]">
                <SelectValue placeholder="Selecciona una unidad…" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {unidadesOrdenadas.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    #{u.numero} · {u.folio_mant}
                    {u.propietario !== "—" && ` · ${u.propietario}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label htmlFor="tipo" className="text-[12px]">
              Tipo
            </Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
              <SelectTrigger id="tipo" className="h-9 text-[13px]">
                <SelectValue placeholder="Selecciona un tipo…" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Monto */}
          <div className="space-y-1.5">
            <Label htmlFor="monto" className="text-[12px]">
              Monto (MXN)
            </Label>
            <Input
              id="monto"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="h-9 text-[13px]"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="descripcion" className="text-[12px]">
              Descripción
            </Label>
            <Textarea
              id="descripcion"
              placeholder="Detalle de la multa o pago extra…"
              className="min-h-[80px] text-[13px]"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          {/* Comprobante (opcional) */}
          <div className="space-y-1.5">
            <Label className="text-[12px]">Comprobante (opcional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {!file ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-[12px] w-full justify-start"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" /> Subir archivo (PDF o imagen)
              </Button>
            ) : (
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                  <span className="text-[12px] truncate">{file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-muted-foreground hover:text-destructive p-1"
                  aria-label="Quitar archivo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            data-cta="condominio.multa.guardar"
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!formValido || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Guardando…
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Extrae el mensaje real del error. supabase-js devuelve PostgrestError
 * como objeto plano (`{ message, details, hint, code }`) — `err instanceof
 * Error` falla y el mensaje se pierde. Este helper cubre los shapes
 * comunes (Error, PostgrestError, AuthError, string).
 */
function pgErrorMessage(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const e = err as Record<string, unknown>;
    const parts = [e.message, e.details, e.hint, e.code]
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    if (parts.length > 0) return parts.join(" — ");
  }
  return null;
}
