// Carga masiva de contactos al CRM desde Excel/CSV, con asistente de mapeo de columnas.
// El usuario sube su archivo (cualquier formato), mapea qué columna es qué campo del CRM,
// previsualiza y confirma. Inserta en cascada (personas → entidades_relacionadas tipo 7 →
// crm_leads_atribucion → categoría), dedup por correo/teléfono, propietario = quien sube.

import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchCrmCategorias } from "@/hooks/useCrmCatalogos";
import { PERSONA_EMAIL_RE, PERSONA_PHONE_RE } from "@/lib/crm-validaciones";

// Campos del CRM a los que se puede mapear una columna del archivo.
const CRM_FIELDS = [
  { key: "nombre", label: "Nombre", required: true },
  { key: "apellidos", label: "Apellidos", required: false },
  { key: "correo", label: "Correo", required: false },
  { key: "telefono", label: "Teléfono", required: false },
  { key: "origen_agente", label: "Agente/Inmobiliaria", required: false },
  { key: "lead_status", label: "Estado del lead", required: false },
  { key: "etapa_ciclo_vida", label: "Etapa ciclo de vida", required: false },
] as const;
type FieldKey = typeof CRM_FIELDS[number]["key"];

// Sinónimos de encabezado para auto-sugerir el mapeo.
const HEADER_SYNONYMS: Record<FieldKey, string[]> = {
  nombre: ["nombre", "nombres", "name", "first name", "nombre completo"],
  apellidos: ["apellidos", "apellido", "last name", "apellido paterno"],
  correo: ["correo", "email", "e-mail", "mail", "correo electronico"],
  telefono: ["telefono", "celular", "phone", "movil", "numero", "numero de telefono", "tel", "whatsapp"],
  lead_status: ["estado del lead", "estado", "status", "lead status", "estatus"],
  origen_agente: ["agente", "inmobiliaria", "agente independiente", "agente independiente/inmobiliaria", "independiente", "procedencia", "agente externo"],
  etapa_ciclo_vida: ["etapa del ciclo de vida", "ciclo de vida", "lifecycle", "lifecycle stage", "etapa ciclo"],
};

const norm = (s: unknown) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const NONE = "__none__"; // valor para "(ninguna columna)"

type ParsedRow = {
  rowNum: number;
  nombre_legal: string;
  correo: string;
  telefono: string;
  origen_agente: string;
  lead_status: string;
  etapa_ciclo_vida: string;
  errors: string[];
};

type ImportResult = { creados: number; duplicados: number; invalidos: number; errores: number; detalleErrores: string[] };

export function CargaMasivaDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, number>>({ nombre: -1, apellidos: -1, correo: -1, telefono: -1, lead_status: -1, origen_agente: -1, etapa_ciclo_vida: -1 });
  const [catFija, setCatFija] = useState<string>(""); // id de categoría fija para todo el lote ("" = ninguna)

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data: catalog = [] } = useQuery({ queryKey: ["crm-categorias"], queryFn: fetchCrmCategorias });

  const reset = () => {
    setStep(1); setFileName(""); setHeaders([]); setDataRows([]);
    setMapping({ nombre: -1, apellidos: -1, correo: -1, telefono: -1, lead_status: -1, origen_agente: -1, etapa_ciclo_vida: -1 });
    setCatFija(""); setImporting(false); setProgress(0); setResult(null);
  };

  // ── Paso 1: leer archivo ──────────────────────────────────────────────────
  const onFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as unknown[][];
      if (!matrix.length) { toast.error("El archivo está vacío"); return; }
      const hs = (matrix[0] ?? []).map((h) => String(h ?? "").trim());
      const rows = matrix.slice(1).filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
      if (!rows.length) { toast.error("El archivo no tiene filas de datos"); return; }
      // Auto-sugerir mapeo por nombre de encabezado.
      const auto: Record<FieldKey, number> = { nombre: -1, apellidos: -1, correo: -1, telefono: -1, lead_status: -1, origen_agente: -1, etapa_ciclo_vida: -1 };
      for (const f of CRM_FIELDS) {
        const idx = hs.findIndex((h) => HEADER_SYNONYMS[f.key].some((syn) => norm(h) === syn || norm(h).includes(syn)));
        auto[f.key] = idx;
      }
      setFileName(file.name); setHeaders(hs); setDataRows(rows); setMapping(auto); setStep(2);
    } catch (e: any) {
      toast.error("No se pudo leer el archivo: " + (e?.message ?? "formato inválido"));
    }
  };

  // ── Transformar + validar filas según el mapeo (memoizado) ────────────────
  const parsed: ParsedRow[] = useMemo(() => {
    const cell = (row: unknown[], key: FieldKey) => {
      const idx = mapping[key];
      return idx >= 0 ? String(row[idx] ?? "").trim() : "";
    };
    return dataRows.map((row, i) => {
      const nombre = cell(row, "nombre");
      const apellidos = cell(row, "apellidos");
      const correo = cell(row, "correo");
      const telefono = cell(row, "telefono");
      const nombre_legal = [nombre, apellidos].filter(Boolean).join(" ").trim();
      const errors: string[] = [];
      if (!nombre_legal) errors.push("Sin nombre");
      if (!correo && !telefono) errors.push("Sin correo ni teléfono");
      if (correo && !PERSONA_EMAIL_RE.test(correo)) errors.push("Correo inválido");
      if (telefono && !PERSONA_PHONE_RE.test(telefono)) errors.push("Teléfono inválido");
      return { rowNum: i + 2, nombre_legal, correo, telefono, origen_agente: cell(row, "origen_agente"), lead_status: cell(row, "lead_status"), etapa_ciclo_vida: cell(row, "etapa_ciclo_vida"), errors };
    });
  }, [dataRows, mapping]);

  const validRows = parsed.filter((p) => p.errors.length === 0);
  const invalidCount = parsed.length - validRows.length;
  const canContinueMapping = mapping.nombre >= 0 && (mapping.correo >= 0 || mapping.telefono >= 0);

  // ── Paso 4: importar en cascada con dedup ─────────────────────────────────
  const runImport = async () => {
    setImporting(true); setProgress(0);
    const res: ImportResult = { creados: 0, duplicados: 0, invalidos: invalidCount, errores: 0, detalleErrores: [] };

    // Pre-cargar duplicados existentes en BD (por correo y por teléfono).
    const emails = [...new Set(validRows.map((v) => v.correo.toLowerCase()).filter(Boolean))];
    const phones = [...new Set(validRows.map((v) => v.telefono).filter(Boolean))];
    const existentes = new Set<string>();
    try {
      if (emails.length) {
        const { data } = await (supabase as any).from("personas").select("email").in("email", emails);
        (data ?? []).forEach((r: any) => r.email && existentes.add("e:" + String(r.email).toLowerCase()));
      }
      if (phones.length) {
        const { data } = await (supabase as any).from("personas").select("telefono").in("telefono", phones);
        (data ?? []).forEach((r: any) => r.telefono && existentes.add("t:" + String(r.telefono)));
      }
    } catch { /* si falla la pre-carga, seguimos sin dedup contra BD */ }

    const enArchivo = new Set<string>(); // dedup dentro del propio archivo
    for (let i = 0; i < validRows.length; i++) {
      const c = validRows[i];
      const key = c.correo ? "e:" + c.correo.toLowerCase() : c.telefono ? "t:" + c.telefono : null;
      if (key && (existentes.has(key) || enArchivo.has(key))) { res.duplicados++; setProgress(Math.round(((i + 1) / validRows.length) * 100)); continue; }
      if (key) enArchivo.add(key);
      try {
        const { data: persona, error: pErr } = await (supabase as any).from("personas").insert({
          tipo_persona: "pf", nombre_legal: c.nombre_legal, email: c.correo || null, telefono: c.telefono || null,
        }).select("id").single();
        if (pErr) throw pErr;
        const { data: er, error: eErr } = await (supabase as any).from("entidades_relacionadas").insert({
          id_persona: persona.id, id_tipo_entidad: 7, id_proyecto: null,
        }).select("id").single();
        if (eErr) throw eErr;
        // Estado del CRM + propietario (best-effort).
        await (supabase as any).from("crm_leads_atribucion").insert({
          id_entidad_relacionada: er.id, estatus_lead: c.lead_status || "nuevo",
          etapa_ciclo_vida: c.etapa_ciclo_vida || "lead", id_propietario: user?.id ?? null,
          origen_agente: c.origen_agente || null,
        });
        // Categoría fija del lote (best-effort).
        if (catFija) {
          await (supabase as any).from("entidades_relacionadas_categorias")
            .insert({ id_entidad_relacionada: er.id, id_categoria: Number(catFija), activo: true });
        }
        res.creados++;
      } catch (e: any) {
        res.errores++;
        if (res.detalleErrores.length < 50) res.detalleErrores.push(`Fila ${c.rowNum}: ${e?.message ?? "error"}`);
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setResult(res); setImporting(false); setStep(4);
    if (res.creados > 0) { toast.success(`${res.creados} contactos importados`); onCreated(); }
  };

  const setMap = (key: FieldKey, val: string) => setMapping((m) => ({ ...m, [key]: val === NONE ? -1 : Number(val) }));

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/30">
          <Upload className="h-4 w-4 mr-1" />Carga masiva
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Carga masiva de contactos
            <span className="ml-2 text-xs font-normal text-muted-foreground">Paso {step} de 4</span>
          </DialogTitle>
        </DialogHeader>

        {/* ── Paso 1: subir ── */}
        {step === 1 && (
          <div className="py-6">
            <label className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border p-10 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Selecciona un archivo Excel o CSV</span>
              <span className="text-xs text-muted-foreground">.xlsx · .xls · .csv — la primera fila debe ser el encabezado</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }} />
            </label>
          </div>
        )}

        {/* ── Paso 2: mapear ── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Archivo: <span className="font-medium text-foreground">{fileName}</span> · {dataRows.length} filas.
              Indica qué columna corresponde a cada campo. Las que no asignes se ignoran.
            </p>
            <div className="space-y-2.5">
              {CRM_FIELDS.map((f) => (
                <div key={f.key} className="grid grid-cols-[140px_1fr] items-center gap-3">
                  <span className="text-sm">{f.label}{f.required && <span className="text-red-500"> *</span>}</span>
                  <Select value={mapping[f.key] >= 0 ? String(mapping[f.key]) : NONE} onValueChange={(v) => setMap(f.key, v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>(ninguna)</SelectItem>
                      {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Columna ${i + 1}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {catalog.length > 0 && (
                <div className="grid grid-cols-[140px_1fr] items-center gap-3 border-t pt-2.5 mt-1">
                  <span className="text-sm">Categoría (todo el lote)</span>
                  <Select value={catFija || NONE} onValueChange={(v) => setCatFija(v === NONE ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin categoría</SelectItem>
                      {catalog.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {!canContinueMapping && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />Mapea al menos <b>Nombre</b> y (Correo o Teléfono) para continuar.
              </p>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setStep(1); }}><ArrowLeft className="h-4 w-4 mr-1" />Atrás</Button>
              <Button disabled={!canContinueMapping} onClick={() => setStep(3)} className="bg-primary hover:bg-primary/90 text-primary-foreground">Vista previa</Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Paso 3: vista previa ── */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">{validRows.length} válidas</Badge>
              {invalidCount > 0 && <Badge className="bg-red-500/15 text-red-700 dark:text-red-400">{invalidCount} con error (se omiten)</Badge>}
              {catFija && <span className="text-xs text-muted-foreground">Categoría: {catalog.find((c) => String(c.id) === catFija)?.nombre}</span>}
            </div>
            <div className="rounded-md border overflow-auto max-h-[320px]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Nombre</TableHead><TableHead>Correo</TableHead><TableHead>Teléfono</TableHead><TableHead>Estado</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {parsed.slice(0, 20).map((p) => (
                    <TableRow key={p.rowNum} className={p.errors.length ? "bg-red-500/5" : ""}>
                      <TableCell className="text-xs text-muted-foreground">{p.rowNum}</TableCell>
                      <TableCell className="text-sm">{p.nombre_legal || <span className="text-red-500 text-xs">—</span>}</TableCell>
                      <TableCell className="text-sm">{p.correo || "—"}</TableCell>
                      <TableCell className="text-sm">{p.telefono || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {p.errors.length ? <span className="text-red-600 dark:text-red-400">{p.errors.join(", ")}</span> : <span className="text-emerald-600 dark:text-emerald-400">OK</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsed.length > 20 && <p className="text-[11px] text-muted-foreground">Mostrando 20 de {parsed.length} filas.</p>}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(2)} disabled={importing}><ArrowLeft className="h-4 w-4 mr-1" />Atrás</Button>
              <Button onClick={runImport} disabled={importing || validRows.length === 0} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {importing ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Importando… {progress}%</> : `Importar ${validRows.length} contactos`}
              </Button>
            </DialogFooter>
            {importing && <Progress value={progress} className="h-1.5" />}
          </div>
        )}

        {/* ── Paso 4: reporte ── */}
        {step === 4 && result && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-lg font-semibold">Importación terminada</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center"><p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{result.creados}</p><p className="text-xs text-muted-foreground">Creados</p></div>
              <div className="rounded-lg border p-3 text-center"><p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{result.duplicados}</p><p className="text-xs text-muted-foreground">Saltados (ya existían)</p></div>
              <div className="rounded-lg border p-3 text-center"><p className="text-2xl font-bold text-muted-foreground">{result.invalidos}</p><p className="text-xs text-muted-foreground">Omitidos (datos inválidos)</p></div>
              <div className="rounded-lg border p-3 text-center"><p className="text-2xl font-bold text-red-600 dark:text-red-400">{result.errores}</p><p className="text-xs text-muted-foreground">Errores</p></div>
            </div>
            {result.detalleErrores.length > 0 && (
              <div className="rounded-md border bg-red-500/5 p-2 max-h-32 overflow-auto text-xs text-red-700 dark:text-red-400 space-y-0.5">
                {result.detalleErrores.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Importar otro archivo</Button>
              <Button onClick={() => { setOpen(false); reset(); }} className="bg-primary hover:bg-primary/90 text-primary-foreground">Cerrar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
