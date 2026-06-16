import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCompetitors } from '@/lib/portal-estructura-comisiones/stores/CompetitorsContext';
import type { Competitor } from '@/lib/portal-estructura-comisiones/types/competitors';

type RowStatus = 'ready' | 'incomplete' | 'format_error' | 'duplicate';
type DupAction = 'update' | 'skip' | 'create_new';

interface ParsedRow {
  raw: Record<string, string>;
  name: string;
  zone: string;
  properties: number;
  averageSqm: number;
  averageTicket: number;
  pricePerSqm: number;
  status: RowStatus;
  errors: string[];
  existingId?: string;
  dupAction: DupAction;
}

const STATUS_META: Record<RowStatus, { label: string; cls: string }> = {
  ready: { label: 'Listo', cls: 'bg-success/10 text-success border-success/20' },
  incomplete: { label: 'Incompleto', cls: 'bg-warning/10 text-warning border-warning/20' },
  format_error: { label: 'Error de formato', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
  duplicate: { label: 'Duplicado', cls: 'bg-info/10 text-info border-info/20' },
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseMoney(v: string): number {
  if (!v) return NaN;
  const cleaned = v.replace(/[$\s,]/g, '');
  const n = Number(cleaned);
  return isFinite(n) ? n : NaN;
}

function normKey(k: string): string {
  return k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

const COL_MAP: Record<string, string> = {
  proyecto: 'name',
  zona: 'zone',
  propiedades: 'properties',
  m2promedio: 'averageSqm',
  metrospromedio: 'averageSqm',
  tickerpromedio: 'averageTicket',
  ticketpromedio: 'averageTicket',
  precioxm2: 'pricePerSqm',
  preciom2: 'pricePerSqm',
  preciopormetro: 'pricePerSqm',
  preciopormetrocuadrado: 'pricePerSqm',
};

export default function CompetitorsImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { competitors, addCompetitor, updateCompetitor, logImport } = useCompetitors();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setRows([]); setFileName(''); };
  const close = () => { reset(); onOpenChange(false); };

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Solo se aceptan archivos .csv'); return;
    }
    setFileName(file.name);
    const text = await file.text();
    parseCsv(text);
  };

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) { toast.error('CSV vacío o sin filas de datos'); return; }
    const headers = splitCsvLine(lines[0]).map(normKey);
    const fieldByIdx = headers.map(h => COL_MAP[h]);

    const parsed: ParsedRow[] = lines.slice(1).map(line => {
      const cells = splitCsvLine(line);
      const raw: Record<string, string> = {};
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { raw[h] = cells[i] ?? ''; });
      fieldByIdx.forEach((f, i) => { if (f) obj[f] = cells[i] ?? ''; });

      const errors: string[] = [];
      const name = (obj.name ?? '').trim();
      const zone = (obj.zone ?? '').trim();
      if (!name) errors.push('Proyecto vacío');
      if (!zone) errors.push('Zona vacía');

      const properties = Number(String(obj.properties ?? '').replace(/[\s,]/g, ''));
      const averageSqm = Number(String(obj.averageSqm ?? '').replace(/[\s,]/g, ''));
      const averageTicket = parseMoney(obj.averageTicket ?? '');
      const pricePerSqm = parseMoney(obj.pricePerSqm ?? '');

      if (!isFinite(properties)) errors.push('Propiedades inválido');
      if (!isFinite(averageSqm)) errors.push('M² inválido');
      if (!isFinite(averageTicket)) errors.push('Ticket inválido');
      if (!isFinite(pricePerSqm)) errors.push('Precio/m² inválido');

      const existing = name ? competitors.find(c => c.name.trim().toLowerCase() === name.toLowerCase()) : undefined;

      let status: RowStatus = 'ready';
      if (errors.some(e => /vací/.test(e))) status = 'incomplete';
      else if (errors.length) status = 'format_error';
      else if (existing) status = 'duplicate';

      return {
        raw,
        name, zone,
        properties: isFinite(properties) ? properties : 0,
        averageSqm: isFinite(averageSqm) ? averageSqm : 0,
        averageTicket: isFinite(averageTicket) ? averageTicket : 0,
        pricePerSqm: isFinite(pricePerSqm) ? pricePerSqm : 0,
        status, errors,
        existingId: existing?.id,
        dupAction: 'update' as DupAction,
      };
    });
    setRows(parsed);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const updateRowAction = (idx: number, action: DupAction) => {
    setRows(rs => rs.map((r, i) => i === idx ? { ...r, dupAction: action } : r));
  };

  const confirmImport = () => {
    let imported = 0, updated = 0, skipped = 0, errored = 0;
    rows.forEach(r => {
      if (r.status === 'incomplete' || r.status === 'format_error') { errored++; return; }
      if (r.status === 'duplicate' && r.dupAction === 'skip') { skipped++; return; }
      if (r.status === 'duplicate' && r.dupAction === 'update' && r.existingId) {
        const existing = competitors.find(c => c.id === r.existingId);
        if (existing) {
          updateCompetitor({
            ...existing,
            name: r.name, zone: r.zone,
            pricePerSqm: r.pricePerSqm,
            averageTicket: r.averageTicket,
            averageSqm: r.averageSqm,
          });
          updated++;
          return;
        }
      }
      const c: Competitor = {
        id: crypto.randomUUID(),
        name: r.name, zone: r.zone,
        pricePerSqm: r.pricePerSqm,
        averageTicket: r.averageTicket,
        averageSqm: r.averageSqm,
        monthlyAbsorption: 0,
        constructionProgressPct: 0,
        mainPolicy: '',
        maxDiscountPct: 0,
        type: 'directa',
        notes: r.properties ? `Propiedades: ${r.properties}` : undefined,
        createdAt: new Date().toISOString(),
      };
      addCompetitor(c);
      imported++;
    });

    logImport({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      user: 'admin',
      fileName: fileName || 'archivo.csv',
      imported, updated, skipped, errors: errored,
    });

    toast.success(`Benchmark importado correctamente. ${imported} nuevos, ${updated} actualizados, ${skipped} omitidos, ${errored} con error.`);
    close();
  };

  const downloadTemplate = async () => {
    try {
      const res = await fetch('/templates/competidores-plantilla.csv');
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'competidores-plantilla.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('No se pudo descargar la plantilla'); }
  };

  const totalReady = rows.filter(r => r.status === 'ready' || (r.status === 'duplicate' && r.dupAction !== 'skip')).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar CSV de competidores</DialogTitle>
          <DialogDescription>Carga un archivo CSV con el formato del template de benchmark de mercado.</DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-lg border-2 border-dashed p-10 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border'}`}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Arrastra tu archivo CSV aquí</p>
            <p className="text-xs text-muted-foreground mt-1">o</p>
            <input
              ref={inputRef} type="file" accept=".csv" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="flex items-center justify-center gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>Seleccionar archivo</Button>
              <Button variant="ghost" size="sm" onClick={downloadTemplate}><Download className="h-3.5 w-3.5 mr-1" /> Descargar plantilla</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="outline" className="text-xs">{rows.length} filas</Badge>
                <Badge className="text-xs bg-success/10 text-success border-success/20 border">{totalReady} listas</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}><X className="h-3.5 w-3.5 mr-1" /> Cambiar archivo</Button>
            </div>

            <div className="rounded-lg border border-border overflow-auto max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead className="text-right">Props.</TableHead>
                    <TableHead className="text-right">M² prom</TableHead>
                    <TableHead className="text-right">Ticket</TableHead>
                    <TableHead className="text-right">$/m²</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.name || <span className="text-muted-foreground italic">vacío</span>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.zone}</TableCell>
                      <TableCell className="text-right text-xs">{r.properties || '—'}</TableCell>
                      <TableCell className="text-right text-xs">{r.averageSqm || '—'}</TableCell>
                      <TableCell className="text-right text-xs">{r.averageTicket ? `$${r.averageTicket.toLocaleString('es-MX')}` : '—'}</TableCell>
                      <TableCell className="text-right text-xs">{r.pricePerSqm ? `$${r.pricePerSqm.toLocaleString('es-MX')}` : '—'}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs border ${STATUS_META[r.status].cls}`} title={r.errors.join(', ')}>
                          {STATUS_META[r.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.status === 'duplicate' ? (
                          <Select value={r.dupAction} onValueChange={(v: DupAction) => updateRowAction(i, v)}>
                            <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="update">Actualizar</SelectItem>
                              <SelectItem value="skip">Omitir</SelectItem>
                              <SelectItem value="create_new">Crear nuevo</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancelar</Button>
          <Button onClick={confirmImport} disabled={rows.length === 0 || totalReady === 0}>
            Confirmar importación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
