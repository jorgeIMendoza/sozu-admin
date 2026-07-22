// Feed de actividad del CRM: ActivityPanel + Timeline (ficha de contacto) y
// DealActivityFeed (ficha de negocio). Extraído de crm.tsx. Las fichas los consumen.

import { useState } from "react";
import {
  UserPlus, StickyNote, ClipboardList, CalendarClock, Briefcase,
  GitBranch, Zap, MessageSquare, Check, X, TriangleAlert, Search, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoteCard, InlineNoteForm } from "./crm-notas";
import {
  TaskDialog, CitaDialog, TaskActivityCard,
  CITA_TYPE_META, CITA_STATUS_META,
} from "./crm-tareas-citas";
import { relTime, fmtDate, fmtDateTime, fmtMXN, DEAL_STAGES } from "@/lib/crm-lib";
import { stripHtml, fmtCitaWhen } from "@/lib/crm-format";

// ─── (símbolos extraídos abajo; se les añade `export` automáticamente) ──────────
export type TLItem = { id: string; ts: string; kind: string; title: string; subtitle?: string; html?: string; icon: any; tone?: string; type?: string; rawId?: number; status?: string; author?: string | null; anclado?: boolean; attachments?: any[] };

export function ActivityPanel({ contactId, userId, owners, contact, notes, tasks, citas = [], onSaved, onCompleteTask, onDeleteTask, onDeleteNote, onUpdateCita, onDeleteCita, includeSystem = true }: any) {
  const [filter, setFilter] = useState<"all" | "note" | "task" | "cita">("all");
  const [search, setSearch] = useState("");
  const TABS: { id: "all" | "note" | "task" | "cita"; label: string }[] = [
    { id: "all", label: "Todas las actividades" },
    { id: "note", label: "Notas" },
    { id: "task", label: "Tareas" },
    { id: "cita", label: "Citas" },
  ];
  const showNotes = filter === "all" || filter === "note";
  const showTasks = filter === "all" || filter === "task";
  const showCitas = filter === "all" || filter === "cita";
  return (
    <div className="space-y-4">
      {/* Sub-tabs por tipo de actividad */}
      <div className="border-b border-border flex gap-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${filter === t.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Compositor contextual: nota solo en "Notas", crear tarea/cita solo en su pestaña.
          "Todas las actividades" es solo el recap (sin compositor). */}
      {filter === "note" && (
        <InlineNoteForm contactId={contactId} userId={userId} onSaved={onSaved} />
      )}
      {/* Barra: buscador (izq) + acción contextual (der) */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar actividades" className="pl-8 h-8 text-sm" />
        </div>
        {filter === "task" && (
          <TaskDialog contactId={contactId} owners={owners} userId={userId} onSaved={onSaved}
            trigger={
              <Button size="sm" variant="outline" className="h-8 gap-1.5 shrink-0 border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/30">
                <Plus className="h-3.5 w-3.5" />Crear tarea
              </Button>
            } />
        )}
        {filter === "cita" && (
          <CitaDialog contactId={contactId} owners={owners} userId={userId} onSaved={onSaved}
            trigger={
              <Button size="sm" variant="outline" className="h-8 gap-1.5 shrink-0 border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/30">
                <Plus className="h-3.5 w-3.5" />Crear cita
              </Button>
            } />
        )}
      </div>

      <Timeline
        notes={showNotes ? notes : []}
        tasks={showTasks ? tasks : []}
        citas={showCitas ? citas : []}
        deals={[]} pipelineEvents={[]} conversionEvents={[]}
        contact={contact} search={search} includeSystem={includeSystem && filter === "all"}
        onCompleteTask={onCompleteTask} onDeleteTask={onDeleteTask} onDeleteNote={onDeleteNote}
        onUpdateCita={onUpdateCita} onDeleteCita={onDeleteCita} onEdited={onSaved}
      />
    </div>
  );
}

export function Timeline({ notes, tasks, citas = [], deals, pipelineEvents, conversionEvents, contact, search, includeSystem = true, onCompleteTask, onDeleteTask, onDeleteNote, onUpdateCita, onDeleteCita, onEdited }: any) {
  const synthetic: TLItem = {
    id: "contact-created",
    ts: contact.created_at,
    kind: "Sistema",
    title: "Contacto registrado en SOZU",
    icon: UserPlus,
    tone: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  };

  let items: TLItem[] = [
    ...notes.map((n: any) => ({ id: `n-${n.id}`, type: "note", rawId: n.id, author: n.author, anclado: n.anclado, ts: n.created_at, kind: "Nota", title: stripHtml(n.content ?? "").slice(0, 80) || "Nota", html: n.content, attachments: n.attachments ?? [], icon: StickyNote, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400" })),
    ...tasks.map((t: any) => ({ id: `t-${t.id}`, type: "task", rawId: t.id, status: t.status, ts: t.due_date ? `${t.due_date}T${t.due_time ?? "09:00:00"}` : t.created_at, kind: `Tarea · ${t.status}`, title: t.title, subtitle: t.due_date ? `Vence ${fmtDate(t.due_date)}` : undefined, icon: ClipboardList, tone: "bg-blue-500/15 text-blue-700 dark:text-blue-400" })),
    ...citas.map((c: any) => ({ id: `cita-${c.id}`, type: "cita", rawId: c.id, status: c.status, ts: c.start_at ?? c.created_at, kind: `Cita · ${CITA_STATUS_META[c.status]?.label ?? c.status}`, title: c.title, subtitle: `${CITA_TYPE_META[c.tipo]?.label ?? c.tipo} · ${fmtCitaWhen(c.start_at, c.end_at)}`, icon: CITA_TYPE_META[c.tipo]?.icon ?? CalendarClock, tone: "bg-violet-500/15 text-violet-700 dark:text-violet-400" })),
    ...deals.map((d: any) => ({ id: `d-${d.id}`, ts: d.created_at, kind: `Deal · ${DEAL_STAGES.find((s) => s.id === d.deal_stage)?.label ?? d.deal_stage}`, title: d.deal_name, subtitle: d.value ? fmtMXN(Number(d.value)) : undefined, icon: Briefcase, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-400" })),
    ...pipelineEvents.map((p: any) => ({ id: `p-${p.id}`, ts: p.changed_at, kind: "Pipeline", title: `${p.old_stage ?? "—"} → ${p.new_stage}`, icon: GitBranch, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" })),
    ...conversionEvents.map((c: any) => ({ id: `c-${c.id}`, ts: c.event_time, kind: "Evento", title: c.event_name, subtitle: `Meta: ${c.meta_status} · Google: ${c.google_status}`, icon: Zap, tone: "bg-pink-500/15 text-pink-700 dark:text-pink-400" })),
    ...(includeSystem ? [synthetic] : []),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  const q = (search ?? "").trim().toLowerCase();
  if (q) {
    items = items.filter((it) =>
      (it.title ?? "").toLowerCase().includes(q) ||
      stripHtml(it.html ?? "").toLowerCase().includes(q) ||
      (it.kind ?? "").toLowerCase().includes(q));
  }

  const hasRealActivity = items.some((it) => it.id !== "contact-created");

  if (!items.length) {
    return (
      <div className="text-center py-8 border border-dashed border-primary/20 rounded-xl bg-primary/5">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm font-medium text-primary/80">{q ? "Sin resultados" : "Sin actividad registrada aún"}</p>
        <p className="text-xs text-primary/60 mt-1">{q ? "Ajusta la búsqueda" : "Agrega una nota para comenzar el historial"}</p>
      </div>
    );
  }

  // Agrupar por mes, respetando el orden descendente.
  const groups: { key: string; items: TLItem[] }[] = [];
  for (const it of items) {
    const d = new Date(it.ts);
    const key = isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, items: [] }; groups.push(g); }
    g.items.push(it);
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.key}>
          <p className="text-xs font-semibold text-muted-foreground mb-2 capitalize">{g.key}</p>
          <div className="space-y-0">
            {g.items.map((it, i) => {
          if (it.type === "note") {
            return (
              <div key={it.id} className="pb-4 last:pb-0">
                <NoteCard note={{ id: it.rawId, content: it.html, created_at: it.ts, author: it.author, anclado: it.anclado, attachments: it.attachments ?? [] }} contactName={contact.full_name} onEdited={onEdited} onDelete={onDeleteNote} />
              </div>
            );
          }
          const Icon = it.icon;
          return (
            <div key={it.id} className="flex gap-3 relative pb-5 last:pb-0 group/item">
              {i < g.items.length - 1 && (
                <div className="absolute left-3.5 top-7 bottom-0 w-px bg-border/60" />
              )}
              <div className={`mt-0.5 h-7 w-7 shrink-0 rounded-full flex items-center justify-center z-10 ring-2 ring-background shadow-sm ${it.tone ?? "bg-muted"}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5 rounded-lg p-2 -ml-0.5 group-hover/item:bg-slate-50/80 transition-colors duration-100">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{it.kind}</span>
                  <span className="text-xs text-muted-foreground/70 shrink-0 tabular-nums">{relTime(it.ts)}</span>
                </div>
                {it.html ? (
                  <div
                    className="mt-1 prose prose-sm max-w-none text-foreground prose-p:my-0.5 prose-ul:my-0.5 prose-ol:my-0.5 prose-li:my-0 prose-strong:font-semibold prose-a:text-primary prose-img:rounded-md prose-img:my-2"
                    dangerouslySetInnerHTML={{ __html: it.html }}
                  />
                ) : (
                  <>
                    <div className="text-sm mt-0.5 font-medium text-foreground">{it.title}</div>
                    {it.subtitle && <div className="text-xs text-muted-foreground mt-0.5">{it.subtitle}</div>}
                  </>
                )}
                {it.type === "task" && (
                  <div className="flex gap-3 mt-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    {it.status !== "completada" && (
                      <button onClick={() => onCompleteTask?.(it.rawId)} className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1">
                        <Check className="h-3 w-3" />Completar
                      </button>
                    )}
                    <button onClick={() => onDeleteTask?.(it.rawId)} className="text-[11px] text-destructive hover:underline inline-flex items-center gap-1">
                      <X className="h-3 w-3" />Eliminar
                    </button>
                  </div>
                )}
                {it.type === "cita" && (
                  <div className="flex gap-3 mt-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    {(it.status === "programada" || it.status === "reprogramada") && (
                      <>
                        <button onClick={() => onUpdateCita?.(it.rawId, "realizada")} className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1">
                          <Check className="h-3 w-3" />Realizada
                        </button>
                        <button onClick={() => onUpdateCita?.(it.rawId, "no_asistio")} className="text-[11px] text-amber-600 hover:underline inline-flex items-center gap-1">
                          <TriangleAlert className="h-3 w-3" />No asistió
                        </button>
                      </>
                    )}
                    <button onClick={() => onDeleteCita?.(it.rawId)} className="text-[11px] text-destructive hover:underline inline-flex items-center gap-1">
                      <X className="h-3 w-3" />Eliminar
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
            })}
          </div>
        </div>
      ))}
      {!hasRealActivity && (
        <div className="text-center py-6 border border-dashed border-primary/20 rounded-xl bg-primary/5">
          <p className="text-sm font-medium text-primary/80">Sin actividad registrada aún</p>
          <p className="text-xs text-primary/60 mt-1">Agrega una nota o tarea para comenzar el historial</p>
        </div>
      )}
    </div>
  );
}

export function DealActivityFeed({ notes, tasks, search, defaultExpanded, expandNonce, contactName, onCompleteTask, onDeleteTask, onDeleteNote, onEdited }: any) {
  const q = (search ?? "").trim().toLowerCase();
  const items = [
    ...(notes ?? []).map((n: any) => ({ kind: "note" as const, id: n.id, ts: n.created_at, data: n, text: stripHtml(n.content ?? "") })),
    ...(tasks ?? []).map((t: any) => ({ kind: "task" as const, id: t.id, ts: t.due_date || t.created_at, data: t, text: t.title ?? "" })),
  ]
    .filter((it) => !q || it.text.toLowerCase().includes(q))
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  if (!items.length) {
    return <p className="text-xs text-muted-foreground text-center py-6">{q ? "Sin resultados" : "Sin actividad registrada aún"}</p>;
  }

  const groups: { key: string; items: typeof items }[] = [];
  for (const it of items) {
    const d = new Date(it.ts);
    const key = isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, items: [] }; groups.push(g); }
    g.items.push(it);
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.key}>
          <p className="text-xs font-semibold text-muted-foreground mb-2 capitalize">{g.key}</p>
          <div className="space-y-2">
            {g.items.map((it) => it.kind === "note" ? (
              <NoteCard key={`n-${it.id}-${expandNonce}`} note={it.data} contactName={contactName ?? ""} defaultExpanded={defaultExpanded} onEdited={onEdited} onDelete={onDeleteNote} />
            ) : (
              <TaskActivityCard key={`t-${it.id}-${expandNonce}`} task={it.data} defaultExpanded={defaultExpanded} onComplete={onCompleteTask} onDelete={onDeleteTask} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
