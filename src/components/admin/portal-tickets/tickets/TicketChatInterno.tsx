// Chat interno de atención (Fase 4) — dentro del detalle de un ticket.
// Solo staff: creador + propietarios (o admin). "2 unidos" = 2 participantes para habilitar
// el input. Al iniciar, notifica (WhatsApp + correo) a los demás stakeholders para que se unan.
// Mensajes en tiempo real (Supabase Realtime, acotado por RLS de pertenencia). Todo persiste.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTickets, enviarCorreoChatInvite } from "@/lib/portal-tickets/tickets-store";
import type { Ticket } from "@/lib/portal-tickets/tickets-data";
import { fetchChatData, unirseChat, enviarMensajeChat } from "@/lib/portal-tickets/tickets-chat";

export function TicketChatInterno({ ticket }: { ticket: Ticket }) {
  const qc = useQueryClient();
  const { agentes } = useTickets();
  const { user, profile } = useAuth();
  const uid = user?.id ?? "";

  const esAdmin = profile?.rol_id === 1 || profile?.rol_id === 2;
  const esStakeholder = uid === ticket.creadoPorId || ticket.propietarios.includes(uid);
  const puedeParticipar = esStakeholder || esAdmin;

  const queryKey = ["ticket-chat", ticket.id];
  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchChatData(ticket.id),
    enabled: !!ticket.id,
  });
  const mensajes = data?.mensajes ?? [];
  const participantes = data?.participantes ?? [];
  const soyParticipante = participantes.some((p) => p.idUsuario === uid);
  const chatIniciado = participantes.length > 0;
  const activo = participantes.length >= 2 && soyParticipante;

  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const invalidar = () => qc.invalidateQueries({ queryKey });

  // Realtime: mensajes y uniones de ESTE ticket → refresca al instante.
  useEffect(() => {
    const canal = supabase
      .channel(`ticket-chat-${ticket.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets_chat_mensajes", filter: `id_ticket=eq.${ticket.id}` },
        () => qc.invalidateQueries({ queryKey: ["ticket-chat", ticket.id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets_chat_participantes", filter: `id_ticket=eq.${ticket.id}` },
        () => qc.invalidateQueries({ queryKey: ["ticket-chat", ticket.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [ticket.id, qc]);

  // Auto-scroll al último mensaje.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [mensajes.length]);

  const nombreDe = (id: string) => agentes.find((a) => a.id === id)?.nombre ?? "Usuario";

  const iniciar = async () => {
    try {
      await unirseChat(ticket.id, uid);
      invalidar();
      // Notificar a creador + propietarios (menos yo) para que se unan.
      const ids = Array.from(
        new Set([ticket.creadoPorId, ...ticket.propietarios].filter(Boolean) as string[]),
      ).filter((id) => id !== uid);
      const destinatarios = ids
        .map((id) => agentes.find((a) => a.id === id))
        .filter((a): a is NonNullable<typeof a> => !!a?.email)
        .map((a) => ({ email: a.email, nombre: a.nombre, telefono: a.telefono }));
      if (destinatarios.length > 0) {
        enviarCorreoChatInvite(destinatarios, {
          folio: ticket.numero,
          nombre: ticket.nombre,
          por: nombreDe(uid),
        });
        toast.success("Chat iniciado. Se notificó a los involucrados para que se unan.");
      } else {
        toast.success("Chat iniciado.");
      }
    } catch {
      toast.error("No se pudo iniciar el chat.");
    }
  };

  const unirse = async () => {
    try {
      await unirseChat(ticket.id, uid);
      invalidar();
    } catch {
      toast.error("No se pudo unir al chat.");
    }
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando || !activo) return;
    setEnviando(true);
    setTexto("");
    try {
      await enviarMensajeChat(ticket.id, uid, t);
      invalidar();
    } catch {
      toast.error("No se pudo enviar el mensaje.");
      setTexto(t);
    } finally {
      setEnviando(false);
    }
  };

  if (!puedeParticipar) {
    return (
      <p className="text-sm text-muted-foreground">
        El chat interno es solo para el creador y los propietarios del ticket.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {chatIniciado && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{participantes.length} en el chat:</span>
          {participantes.map((p) => (
            <span key={p.idUsuario} className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
              {nombreDe(p.idUsuario)}
            </span>
          ))}
        </div>
      )}

      {!chatIniciado ? (
        <Button onClick={iniciar} className="w-full">
          <MessageSquare className="size-4" /> Iniciar chat
        </Button>
      ) : !soyParticipante ? (
        <Button onClick={unirse} variant="outline" className="w-full">
          Unirse al chat
        </Button>
      ) : !activo ? (
        <p className="rounded-md border border-dashed bg-muted/40 p-3 text-center text-sm text-muted-foreground">
          Esperando a que se una alguien más… ({participantes.length}/2)
        </p>
      ) : null}

      {soyParticipante && (
        <>
          <div ref={scrollRef} className="max-h-72 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-3">
            {mensajes.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Aún no hay mensajes.</p>
            ) : (
              mensajes.map((m) => {
                const mio = m.idAutor === uid;
                return (
                  <div key={m.id} className={cn("flex", mio ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-3 py-1.5 text-sm",
                        mio ? "bg-primary text-primary-foreground" : "border bg-card",
                      )}
                    >
                      {!mio && (
                        <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">
                          {nombreDe(m.idAutor)}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder={activo ? "Escribe un mensaje…" : "Se habilita cuando se unan 2"}
              disabled={!activo || enviando}
            />
            <Button onClick={enviar} disabled={!activo || enviando || !texto.trim()} size="icon" aria-label="Enviar">
              <Send className="size-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
