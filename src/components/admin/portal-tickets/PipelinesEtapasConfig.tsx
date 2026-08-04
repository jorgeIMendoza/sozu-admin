// Configuración unificada de Pipelines + Etapas del portal de tickets (una sola pantalla,
// tipo master-detail, replicando la de Pipelines del CRM). Lista de pipelines a la izquierda;
// al seleccionar uno, se editan sus etapas a la derecha (crear/editar/eliminar/reordenar).
// Etapas de tickets usan `cerrada` (finaliza el ticket) en vez de probabilidad/ganado/perdido.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

type PipelineRow = { id: number; nombre: string; descripcion: string | null; orden: number };
type EtapaRow = { id: number; nombre: string; orden: number; cerrada: boolean };

function usePipelines() {
  return useQuery({
    queryKey: ["tickets-cfg-pipelines"],
    queryFn: async () => {
      const { data } = await sb
        .from("tickets_pipelines")
        .select("id, nombre, descripcion, orden")
        .eq("activo", true)
        .order("orden");
      return (data ?? []) as PipelineRow[];
    },
  });
}

// Alta/edición de una etapa (tickets_etapas).
function StageDialog({
  pipelineId,
  stage,
  nextOrden,
  onClose,
  onSaved,
}: {
  pipelineId: number;
  stage: EtapaRow | null;
  nextOrden: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!stage;
  const [nombre, setNombre] = useState(stage?.nombre ?? "");
  const [cerrada, setCerrada] = useState(!!stage?.cerrada);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    const payload = { nombre: nombre.trim(), cerrada };
    const res = isEdit
      ? await sb.from("tickets_etapas").update(payload).eq("id", stage!.id)
      : await sb.from("tickets_etapas").insert({ ...payload, id_pipeline: pipelineId, orden: nextOrden, activo: true });
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(isEdit ? "Etapa actualizada" : "Etapa creada");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar etapa" : "Nueva etapa"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          </div>
          <div className="flex items-center justify-between rounded-md border p-2.5">
            <Label className="text-sm font-normal">Cierra el ticket (etapa final)</Label>
            <Switch checked={cerrada} onCheckedChange={setCerrada} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !nombre.trim()}>
            {isEdit ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Editor de etapas de un pipeline (lista + reordenar + CRUD).
function StagesEditor({ pipelineId, soloLectura }: { pipelineId: number | null; soloLectura: boolean }) {
  const qc = useQueryClient();
  const [dlg, setDlg] = useState<{ open: boolean; stage: EtapaRow | null }>({ open: false, stage: null });
  const { data: stages, isLoading } = useQuery({
    queryKey: ["tickets-cfg-etapas", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data } = await sb
        .from("tickets_etapas")
        .select("id, nombre, orden, cerrada")
        .eq("id_pipeline", pipelineId)
        .eq("activo", true)
        .order("orden");
      return (data ?? []) as EtapaRow[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tickets-cfg-etapas", pipelineId] });
  const list = stages ?? [];

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[idx];
    const b = list[j];
    await sb.from("tickets_etapas").update({ orden: b.orden }).eq("id", a.id);
    await sb.from("tickets_etapas").update({ orden: a.orden }).eq("id", b.id);
    invalidate();
  };
  const remove = async (id: number) => {
    const res = await sb.from("tickets_etapas").update({ activo: false }).eq("id", id);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Etapa eliminada");
    invalidate();
  };

  if (!pipelineId)
    return <p className="py-2 text-sm text-muted-foreground">Selecciona un pipeline para ver sus etapas.</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{list.length} etapa(s)</p>
        {!soloLectura && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setDlg({ open: true, stage: null })}
          >
            <Plus className="mr-1 h-3 w-3" />
            Agregar etapa
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : list.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">Sin etapas. Agrega la primera.</p>
      ) : (
        list.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2.5">
            {!soloLectura && (
              <div className="-my-1 flex flex-col">
                <button
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled={i === list.length - 1}
                  onClick={() => move(i, 1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <span className="flex-1 truncate text-sm">{s.nombre}</span>
            {s.cerrada && (
              <Badge className="bg-muted text-[10px] text-muted-foreground">Cierra</Badge>
            )}
            {!soloLectura && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                  onClick={() => setDlg({ open: true, stage: s })}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive opacity-60 hover:opacity-100"
                  onClick={() => remove(s.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        ))
      )}
      {dlg.open && pipelineId && (
        <StageDialog
          pipelineId={pipelineId}
          stage={dlg.stage}
          nextOrden={list.reduce((m, s) => Math.max(m, s.orden ?? 0), 0) + 10}
          onClose={() => setDlg({ open: false, stage: null })}
          onSaved={() => {
            invalidate();
            setDlg({ open: false, stage: null });
          }}
        />
      )}
    </div>
  );
}

// Alta/edición de un pipeline (tickets_pipelines): nombre + descripción.
function PipelineDialog({
  pipeline,
  onClose,
  onSaved,
}: {
  pipeline: PipelineRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!pipeline;
  const [nombre, setNombre] = useState(pipeline?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(pipeline?.descripcion ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    let res;
    if (isEdit) {
      res = await sb
        .from("tickets_pipelines")
        .update({ nombre: nombre.trim(), descripcion: descripcion.trim() || null })
        .eq("id", pipeline!.id);
    } else {
      const { data: maxRow } = await sb
        .from("tickets_pipelines")
        .select("orden")
        .order("orden", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrden = ((maxRow?.orden ?? 0) as number) + 10;
      res = await sb
        .from("tickets_pipelines")
        .insert({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, orden: nextOrden, activo: true });
    }
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(isEdit ? "Pipeline actualizado" : "Pipeline creado");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar pipeline" : "Nuevo pipeline"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Nombre del pipeline</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              placeholder="Ej. Atención al Cliente"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Descripción</Label>
            <Textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !nombre.trim()}>
            {isEdit ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Alta/edición de una categoría del pipeline (tickets_categorias.id_pipeline).
function CategoriaDialog({
  pipelineId,
  cat,
  onClose,
  onSaved,
}: {
  pipelineId: number;
  cat: { id: number; nombre: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!cat;
  const [nombre, setNombre] = useState(cat?.nombre ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    const res = isEdit
      ? await sb.from("tickets_categorias").update({ nombre: nombre.trim() }).eq("id", cat!.id)
      : await sb.from("tickets_categorias").insert({ nombre: nombre.trim(), id_pipeline: pipelineId, activo: true });
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(isEdit ? "Categoría actualizada" : "Categoría creada");
    onSaved();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label>Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !nombre.trim()}>
            {isEdit ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Editor de categorías de un pipeline (chips + CRUD). Las categorías son siempre por pipeline.
function CategoriasEditor({ pipelineId, soloLectura }: { pipelineId: number | null; soloLectura: boolean }) {
  const qc = useQueryClient();
  const [dlg, setDlg] = useState<{ open: boolean; cat: { id: number; nombre: string } | null }>({ open: false, cat: null });
  const { data: cats, isLoading } = useQuery({
    queryKey: ["tickets-cfg-categorias", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data } = await sb
        .from("tickets_categorias")
        .select("id, nombre")
        .eq("id_pipeline", pipelineId)
        .eq("activo", true)
        .order("orden");
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tickets-cfg-categorias", pipelineId] });
  const list = cats ?? [];
  const remove = async (id: number) => {
    const res = await sb.from("tickets_categorias").update({ activo: false }).eq("id", id);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Categoría eliminada");
    invalidate();
  };
  if (!pipelineId) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Categorías de este pipeline ({list.length})</p>
        {!soloLectura && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setDlg({ open: true, cat: null })}
          >
            <Plus className="mr-1 h-3 w-3" />
            Agregar categoría
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : list.length === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">
          Sin categorías. Agrega la primera para este pipeline.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2.5">
              <span className="flex-1 truncate text-sm">{c.nombre}</span>
              {!soloLectura && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                    onClick={() => setDlg({ open: true, cat: c })}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive opacity-60 hover:opacity-100"
                    onClick={() => remove(c.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {dlg.open && pipelineId && (
        <CategoriaDialog
          pipelineId={pipelineId}
          cat={dlg.cat}
          onClose={() => setDlg({ open: false, cat: null })}
          onSaved={() => {
            invalidate();
            setDlg({ open: false, cat: null });
          }}
        />
      )}
    </div>
  );
}

// Pantalla de Categorías con el mismo diseño master-detail que Pipelines, pero SOLO para
// gestionar las categorías de cada pipeline: eliges un pipeline a la izquierda y editas sus
// categorías a la derecha. Reutiliza usePipelines + CategoriasEditor.
export function CategoriasPorPipelineConfig({ soloLectura = false }: { soloLectura?: boolean }) {
  const { data: pipelines, isLoading } = usePipelines();
  const [sel, setSel] = useState<number | null>(null);
  const list = pipelines ?? [];
  const selId = sel ?? (list[0]?.id ?? null);
  const active = list.find((p) => p.id === selId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          Cada pipeline tiene sus propias categorías. Elige un pipeline para ver y editar las suyas.
        </p>
      </div>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay pipelines. Crea uno primero en Pipelines.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            {list.map((p) => (
              <button
                key={p.id}
                onClick={() => setSel(p.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selId === p.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
                }`}
              >
                {p.nombre}
              </button>
            ))}
          </div>
          <div className="md:col-span-3">
            {!active ? (
              <p className="text-sm text-muted-foreground">Selecciona un pipeline.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold">{active.nombre}</p>
                <CategoriasEditor pipelineId={active.id} soloLectura={soloLectura} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PipelinesEtapasConfig({ soloLectura = false }: { soloLectura?: boolean }) {
  const qc = useQueryClient();
  const { data: pipelines, isLoading } = usePipelines();
  const [sel, setSel] = useState<number | null>(null);
  const [dlg, setDlg] = useState<{ open: boolean; pipeline: PipelineRow | null }>({ open: false, pipeline: null });
  const list = pipelines ?? [];
  const selId = sel ?? (list[0]?.id ?? null);
  const active = list.find((p) => p.id === selId) ?? null;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tickets-cfg-pipelines"] });

  const removePipeline = async (id: number) => {
    const res = await sb.from("tickets_pipelines").update({ activo: false }).eq("id", id);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Pipeline eliminado");
    if (selId === id) setSel(null);
    invalidate();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pipelines</h1>
          <p className="text-sm text-muted-foreground">
            Crea y edita los pipelines de tickets. Cada pipeline tiene su propio embudo de etapas.
          </p>
        </div>
        {!soloLectura && (
          <Button size="sm" onClick={() => setDlg({ open: true, pipeline: null })}>
            <Plus className="mr-1 h-4 w-4" />
            Nuevo pipeline
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            {list.length === 0 && (
              <p className="px-1 text-xs text-muted-foreground">Sin pipelines. Crea el primero.</p>
            )}
            {list.map((p) => (
              <button
                key={p.id}
                onClick={() => setSel(p.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selId === p.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
                }`}
              >
                {p.nombre}
              </button>
            ))}
          </div>
          <div className="space-y-4 md:col-span-3">
            {!active ? (
              <p className="text-sm text-muted-foreground">Selecciona o crea un pipeline.</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{active.nombre}</p>
                    {active.descripcion && (
                      <p className="text-xs text-muted-foreground">{active.descripcion}</p>
                    )}
                  </div>
                  {!soloLectura && (
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setDlg({ open: true, pipeline: active })}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-destructive"
                        onClick={() => removePipeline(active.id)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Eliminar
                      </Button>
                    </div>
                  )}
                </div>
                <StagesEditor pipelineId={active.id} soloLectura={soloLectura} />
              </>
            )}
          </div>
        </div>
      )}

      {dlg.open && (
        <PipelineDialog
          pipeline={dlg.pipeline}
          onClose={() => setDlg({ open: false, pipeline: null })}
          onSaved={() => {
            invalidate();
            setDlg({ open: false, pipeline: null });
          }}
        />
      )}
    </div>
  );
}
