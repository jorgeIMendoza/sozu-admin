// Módulo WhatsApp (platica propio) — bandeja de conversaciones del agente IA.
// Lee crm_platica_contactos_wa / crm_platica_mensajes (fallback si aún no existe la migración).
// Responder manualmente = fase posterior (requiere endpoint de envío). Hoy: monitorear + pausar el bot.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, AlertTriangle, Bot, User, Pause, Play, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/admin/portal-crm/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { relTime, fmtDateTime } from "@/lib/crm-lib";

type Contacto = { id: number; id_proyecto: number; wa_number: string; nombre: string | null; pausado: boolean; fecha_actualizacion: string | null };
type Mensaje = { id: number; rol: string; contenido: string; fecha_creacion: string };

export function CrmWhatsApp() {
  const qc = useQueryClient();
  const [missing, setMissing] = useState(false);
  const [sel, setSel] = useState<number | null>(null);

  const { data: contactos = [], isLoading } = useQuery({
    queryKey: ["crm-platica-contactos"],
    queryFn: async (): Promise<Contacto[]> => {
      const { data, error } = await (supabase as any).from("crm_platica_contactos_wa")
        .select("id, id_proyecto, wa_number, nombre, pausado, fecha_actualizacion")
        .order("fecha_actualizacion", { ascending: false }).limit(200);
      if (error) { setMissing(true); return []; }
      setMissing(false);
      return (data ?? []) as Contacto[];
    },
  });

  const { data: mensajes = [] } = useQuery({
    queryKey: ["crm-platica-mensajes", sel],
    enabled: sel != null,
    queryFn: async (): Promise<Mensaje[]> => {
      const { data } = await (supabase as any).from("crm_platica_mensajes")
        .select("id, rol, contenido, fecha_creacion").eq("id_contacto_wa", sel)
        .order("id", { ascending: true }).limit(500);
      return (data ?? []) as Mensaje[];
    },
  });

  const selContacto = contactos.find((c) => c.id === sel) ?? null;

  const togglePausa = async (c: Contacto) => {
    const { error } = await (supabase as any).from("crm_platica_contactos_wa")
      .update({ pausado: !c.pausado }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(c.pausado ? "Bot reactivado" : "Bot pausado — atención humana");
    qc.invalidateQueries({ queryKey: ["crm-platica-contactos"] });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp — Conversaciones"
        description="Agente IA por WhatsApp (platica propio). Monitorea y toma el control cuando haga falta."
        actions={
          <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["crm-platica-contactos"] })}>
            <RefreshCw className="w-4 h-4 mr-1" />Actualizar
          </Button>
        }
      />

      {missing && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-amber-800 dark:text-amber-400">
            Módulo en preparación: falta aplicar la migración <code>crm_platica_*</code> (modelo de datos) y desplegar las Edge Functions de WhatsApp.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {/* Lista de conversaciones */}
        <Card className="md:col-span-1">
          <CardContent className="p-0 divide-y max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <div key={i} className="p-3"><Skeleton className="h-10 w-full" /></div>)
            ) : contactos.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Sin conversaciones todavía.</div>
            ) : contactos.map((c) => (
              <button key={c.id} onClick={() => setSel(c.id)}
                className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${sel === c.id ? "bg-muted/60" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{c.nombre || c.wa_number}</span>
                  {c.pausado && <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">humano</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {c.wa_number}{c.fecha_actualizacion ? ` · ${relTime(c.fecha_actualizacion)}` : ""}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Hilo de la conversación */}
        <Card className="md:col-span-2">
          <CardContent className="p-4">
            {!selContacto ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />Elige una conversación.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b pb-2 mb-3">
                  <div>
                    <div className="font-medium">{selContacto.nombre || selContacto.wa_number}</div>
                    <div className="text-xs text-muted-foreground">{selContacto.wa_number}</div>
                  </div>
                  <Button size="sm" variant={selContacto.pausado ? "default" : "outline"} onClick={() => togglePausa(selContacto)}>
                    {selContacto.pausado ? <><Play className="w-3.5 h-3.5 mr-1" />Reactivar bot</> : <><Pause className="w-3.5 h-3.5 mr-1" />Pausar bot</>}
                  </Button>
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {mensajes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Sin mensajes.</p>
                  ) : mensajes.map((m) => (
                    <div key={m.id} className={`flex ${m.rol === "user" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.rol === "user" ? "bg-muted" : "bg-primary/10"}`}>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                          {m.rol === "user" ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                          {m.rol === "user" ? "Cliente" : "Agente"} · {fmtDateTime(m.fecha_creacion)}
                        </div>
                        {m.contenido}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">
                  Responder manualmente desde aquí llega en la siguiente fase (requiere endpoint de envío). Por ahora, pausa el bot para atender desde WhatsApp.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
