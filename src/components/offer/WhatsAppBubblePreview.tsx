import { Phone, Video, MoreVertical, CheckCheck, Mic, Paperclip, Smile, ArrowLeft } from "lucide-react";
import type { Agent } from "@/lib/offers/agent-data";
import { AGENT_PHOTO_FALLBACK } from "@/lib/offers/agent-data";

interface Props {
  agent?: Agent;
  recipientPhone: string;
  messageBody: string;
  quickReplies?: string[];
  sentAt: string;
}

const WhatsAppBubblePreview = ({
  agent,
  recipientPhone,
  messageBody,
  quickReplies,
  sentAt,
}: Props) => {
  const senderName = agent?.fullName ?? "SOZU";
  const senderSubtext = agent?.title ?? "Equipo SOZU";
  const photoUrl = agent?.photoUrl || AGENT_PHOTO_FALLBACK;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  };

  const messageLines = messageBody.split("\n");

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Preview meta header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            Vista previa de WhatsApp
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          a <span className="tabular-nums text-foreground">{recipientPhone}</span>
        </p>
      </div>

      {/* WhatsApp header */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-[#075E54] text-white">
        <ArrowLeft className="w-5 h-5 opacity-80 flex-shrink-0" />
        <img
          src={photoUrl}
          alt={senderName}
          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{senderName}</p>
          <p className="text-[11px] opacity-80 truncate">{senderSubtext}</p>
        </div>
        <div className="flex items-center gap-4 opacity-90">
          <Video className="w-5 h-5" />
          <Phone className="w-4 h-4" />
          <MoreVertical className="w-5 h-5" />
        </div>
      </div>

      {/* Chat background */}
      <div
        className="px-3 py-4 min-h-[280px]"
        style={{
          backgroundColor: "hsl(40 25% 92%)",
          backgroundImage:
            "radial-gradient(circle at 10% 20%, hsl(40 25% 88%) 0%, transparent 40%), radial-gradient(circle at 80% 70%, hsl(40 25% 88%) 0%, transparent 40%)",
        }}
      >
        <div className="flex">
          <div className="max-w-[85%] bg-white rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
            {messageLines.map((line, i) => (
              <p
                key={i}
                className="text-[13px] leading-relaxed text-[#111] whitespace-pre-wrap"
              >
                {line || "\u00A0"}
              </p>
            ))}
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[10px] text-[#667781] tabular-nums">
                {formatTime(sentAt)}
              </span>
              <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
            </div>
          </div>
        </div>

        {quickReplies && quickReplies.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 max-w-[85%]">
            {quickReplies.map((reply, i) => (
              <button
                key={i}
                className="px-3 py-1.5 rounded-full bg-white text-[#075E54] text-[12px] font-medium shadow-sm border border-[#075E54]/10"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input bar (mock) */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#F0F2F5] border-t border-border">
        <Smile className="w-5 h-5 text-[#667781]" />
        <Paperclip className="w-5 h-5 text-[#667781]" />
        <div className="flex-1 px-3 py-1.5 rounded-full bg-white text-[12px] text-[#667781]">
          Mensaje
        </div>
        <div className="w-8 h-8 rounded-full bg-[#075E54] flex items-center justify-center">
          <Mic className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
};

export default WhatsAppBubblePreview;
