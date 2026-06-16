import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useCompetitors } from '@/store/CompetitorsContext';
import { useInventory } from '@/store/InventoryContext';
import type { Competitor, CompetitorType, Diagnosis } from '@/types/competitors';
import { Plus, Trash2, Pencil, Upload, History } from 'lucide-react';
import { toast } from 'sonner';
import CompetitorsImportDialog from '@/components/CompetitorsImportDialog';

const TYPE_LABEL: Record<CompetitorType, string> = {
  directa: 'Directa', indirecta: 'Indirecta', aspiracional: 'Aspiracional', financiera: 'Financiera',
};

function diagnose(own: number, market: number): Diagnosis {
  if (!market || !own) return 'competitive';
  const diff = (own - market) / market;
  if (diff < -0.05) return 'opportunity';
  if (diff <= 0.03) return 'competitive';
  if (diff <= 0.10) return 'slightly_above';
  return 'overpriced';
}

const DIAG_META: Record<Diagnosis, { label: string; cls: string }> = {
  competitive: { label: 'Competitivo', cls: 'bg-success/10 text-success border-success/20' },
  slightly_above: { label: 'Ligeramente arriba', cls: 'bg-warning/10 text-warning border-warning/20' },
  overpriced: { label: 'Riesgo de sobreprecio', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
  opportunity: { label: 'Oportunidad de incremento', cls: 'bg-info/10 text-info border-info/20' },
};

const blank = (): Competitor => ({
  id: crypto.randomUUID(),
  name: '', zone: '',
  pricePerSqm: 0, averageTicket: 0, averageSqm: 0,
  monthlyAbsorption: 0, constructionProgressPct: 0,
  mainPolicy: '', maxDiscountPct: 0, type: 'directa',
  createdAt: new Date().toISOString(),
});

export default function CompetitorsBenchmarkTab() {
  const { competitors, addCompetitor, updateCompetitor, deleteCompetitor, importHistory } = useCompetitors();
  const { units } = useInventory();
  const [editing, setEditing] = useState<Competitor | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const ownPricePerSqm = useMemo(() => {
    const totalValue = units.reduce((s, u) => s + u.currentPrice, 0);
    const totalSqm = units.reduce((s, u) => s + (u.sqmSellable ?? u.sqm ?? 0), 0);
    return totalSqm > 0 ? Math.round(totalValue / totalSqm) : 0;
  }, [units]);

  const marketAvg = competitors.length
    ? Math.round(competitors.reduce((s, c) => s + c.pricePerSqm, 0) / competitors.length)
    : 0;
  const directAvg = competitors.filter(c => c.type === 'directa').length
    ? Math.round(competitors.filter(c => c.type === 'directa').reduce((s, c) => s + c.pricePerSqm, 0) / competitors.filter(c => c.type === 'directa').length)
    : 0;

  const overallDiag = diagnose(ownPricePerSqm, marketAvg);
  const directDiag = diagnose(ownPricePerSqm, directAvg);

  const openNew = () => { setEditing(blank()); setOpen(true); };
  const openEdit = (c: Competitor) => { setEditing(c); setOpen(true); };
  const save = () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error('Nombre requerido'); return; }
    const exists = competitors.find(c => c.id === editing.id);
    if (exists) updateCompetitor(editing); else addCompetitor(editing);
    toast.success('Competidor guardado');
    setOpen(false); setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Tile label="Tu precio / m²" value={ownPricePerSqm ? `$${ownPricePerSqm.toLocaleString('es-MX')}` : '—'} />
        <Tile label="Promedio mercado" value={marketAvg ? `$${marketAvg.toLocaleString('es-MX')}` : '—'} />
        <Tile label="Promedio competencia directa" value={directAvg ? `$${directAvg.toLocaleString('es-MX')}` : '—'} />
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Diagnóstico vs mercado</p>
          {ownPricePerSqm && marketAvg ? (
            <Badge className={`mt-3 border ${DIAG_META[overallDiag].cls}`}>{DIAG_META[overallDiag].label}</Badge>
          ) : <p className="text-xs text-muted-foreground mt-3">Carga inventario y competidores</p>}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Competidores</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" /> Importar CSV
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nuevo competidor</Button>
              </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader><SheetTitle>{editing && competitors.find(c => c.id === editing.id) ? 'Editar' : 'Nuevo'} competidor</SheetTitle></SheetHeader>
              {editing && (
                <div className="space-y-3 mt-4">
                  <Field label="Nombre"><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
                  <Field label="Zona"><Input value={editing.zone} onChange={e => setEditing({ ...editing, zone: e.target.value })} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Precio / m²"><Input type="number" value={editing.pricePerSqm} onChange={e => setEditing({ ...editing, pricePerSqm: Number(e.target.value) })} /></Field>
                    <Field label="Ticket promedio"><Input type="number" value={editing.averageTicket} onChange={e => setEditing({ ...editing, averageTicket: Number(e.target.value) })} /></Field>
                    <Field label="m² promedio"><Input type="number" value={editing.averageSqm} onChange={e => setEditing({ ...editing, averageSqm: Number(e.target.value) })} /></Field>
                    <Field label="Absorción / mes"><Input type="number" value={editing.monthlyAbsorption} onChange={e => setEditing({ ...editing, monthlyAbsorption: Number(e.target.value) })} /></Field>
                    <Field label="% avance obra"><Input type="number" value={editing.constructionProgressPct} onChange={e => setEditing({ ...editing, constructionProgressPct: Number(e.target.value) })} /></Field>
                    <Field label="% descuento máx."><Input type="number" value={editing.maxDiscountPct} onChange={e => setEditing({ ...editing, maxDiscountPct: Number(e.target.value) })} /></Field>
                  </div>
                  <Field label="Política principal"><Input placeholder="ej. 30/60/10" value={editing.mainPolicy} onChange={e => setEditing({ ...editing, mainPolicy: e.target.value })} /></Field>
                  <Field label="Tipo de competencia">
                    <Select value={editing.type} onValueChange={(v: CompetitorType) => setEditing({ ...editing, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              )}
              <SheetFooter className="mt-6"><Button onClick={save}>Guardar</Button></SheetFooter>
            </SheetContent>
          </Sheet>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">$ / m²</TableHead>
                <TableHead className="text-right">Ticket</TableHead>
                <TableHead className="text-right">Absorción</TableHead>
                <TableHead>Política</TableHead>
                <TableHead>Diagnóstico</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitors.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sin competidores aún.</TableCell></TableRow>
              )}
              {competitors.map(c => {
                const d = ownPricePerSqm ? diagnose(ownPricePerSqm, c.pricePerSqm) : 'competitive';
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.zone}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{TYPE_LABEL[c.type]}</Badge></TableCell>
                    <TableCell className="text-right">${c.pricePerSqm.toLocaleString('es-MX')}</TableCell>
                    <TableCell className="text-right">${(c.averageTicket / 1_000_000).toFixed(1)}M</TableCell>
                    <TableCell className="text-right">{c.monthlyAbsorption}/mes</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.mainPolicy}</TableCell>
                    <TableCell>{ownPricePerSqm ? <Badge className={`text-xs border ${DIAG_META[d].cls}`}>{DIAG_META[d].label}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { deleteCompetitor(c.id); toast.success('Eliminado'); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {ownPricePerSqm > 0 && directAvg > 0 && (
        <Card>
          <CardHeader><CardTitle>Posicionamiento vs competencia directa</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge className={`border ${DIAG_META[directDiag].cls}`}>{DIAG_META[directDiag].label}</Badge>
              <span className="text-sm text-muted-foreground">
                {(((ownPricePerSqm - directAvg) / directAvg) * 100).toFixed(1)}% vs ${directAvg.toLocaleString('es-MX')}/m²
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {importHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" /> Histórico de importaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead className="text-right">Importados</TableHead>
                  <TableHead className="text-right">Actualizados</TableHead>
                  <TableHead className="text-right">Omitidos</TableHead>
                  <TableHead className="text-right">Errores</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importHistory.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs">{new Date(h.date).toLocaleString('es-MX')}</TableCell>
                    <TableCell className="text-xs">{h.user}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{h.fileName}</TableCell>
                    <TableCell className="text-right text-xs">{h.imported}</TableCell>
                    <TableCell className="text-right text-xs">{h.updated}</TableCell>
                    <TableCell className="text-right text-xs">{h.skipped}</TableCell>
                    <TableCell className="text-right text-xs">{h.errors}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CompetitorsImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-2">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
