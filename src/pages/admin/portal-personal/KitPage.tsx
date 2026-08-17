
import { useState } from "react";
import { Copy, Download, FileText, Image as ImageIcon, Play, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ACTIVOS } from "@/lib/portal-personal/mock";
import { selectores } from "@/lib/portal-personal/selectores";
import { usePortal } from "@/lib/portal-personal/portal-store";
import type { ActivoPromocion } from "@/lib/portal-personal/tipos";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/admin/portal-personal/comunes/Estados";
import { cn } from "@/lib/utils";


const TIPOS = [
  { v: "todos", l: "Todo" },
  { v: "IMAGEN", l: "Imágenes" },
  { v: "TEXTO", l: "Textos" },
  { v: "PDF", l: "Documentos" },
  { v: "VIDEO", l: "Video" },
] as const;

export default function KitPage() {
  const usuario = usePortal((s) => s.usuario);
  const link = selectores.linkReferido(usuario);
  const [dev, setDev] = useState("todos");
  const [tipo, setTipo] = useState<string>("todos");

  const desarrollos = selectores.desarrollos();
  const lista = ACTIVOS.filter(
    (a) =>
      (dev === "todos" || a.desarrollo_id === dev) && (tipo === "todos" || a.tipo === tipo),
  );

  const copiar = (a: ActivoPromocion) => {
    const texto = `${a.copy ?? a.nombre}\n\nhttps://${link}`;
    void navigator.clipboard.writeText(texto);
    toast.success("Texto copiado con tu link incluido");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-verde-borde bg-verde-claro p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-verde-oscuro" />
        <p className="text-sm text-negro">
          Todo lo que ves aquí está <strong>aprobado por SOZU</strong>. Compártelo tal cual: no
          modifiques precios, fechas de entrega ni promesas de rendimiento.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FiltroPill activo={dev === "todos"} onClick={() => setDev("todos")}>
          Todos los desarrollos
        </FiltroPill>
        {desarrollos.map((d) => (
          <FiltroPill key={d.id} activo={dev === d.id} onClick={() => setDev(d.id)}>
            {d.nombre}
          </FiltroPill>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {TIPOS.map((t) => (
          <FiltroPill key={t.v} activo={tipo === t.v} onClick={() => setTipo(t.v)}>
            {t.l}
          </FiltroPill>
        ))}
      </div>

      {lista.length === 0 ? (
        <EstadoVacio
          titulo="No hay material con estos filtros"
          descripcion="Prueba con otro desarrollo o tipo de material."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((a) => (
            <article key={a.id} className="card-sozu flex flex-col overflow-hidden">
              {a.tipo === "IMAGEN" || a.tipo === "VIDEO" ? (
                <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
                  <img
                    src={a.miniatura}
                    alt={a.nombre}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                  {a.tipo === "VIDEO" && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex size-12 items-center justify-center rounded-full bg-negro/70 text-background">
                        <Play className="size-5" />
                      </span>
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-secondary">
                  {a.tipo === "PDF" ? (
                    <FileText className="size-8 text-gris" />
                  ) : (
                    <p className="line-clamp-6 px-5 text-sm leading-relaxed text-negro">
                      {a.copy}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <p className="eyebrow text-gris">
                    {selectores.desarrolloPorId(a.desarrollo_id)?.nombre}
                  </p>
                  <h3 className="mt-1 font-bold leading-tight text-negro">{a.nombre}</h3>
                  {a.tamano && <p className="num mt-1 text-xs text-gris">{a.tamano}</p>}
                </div>

                <p className="num mt-auto text-xs text-gris">
                  Aprobado por {a.aprobado_por} · {a.aprobado_en}
                </p>

                {a.tipo === "TEXTO" ? (
                  <Button variant="outline" onClick={() => copiar(a)}>
                    <Copy className="size-4" />
                    Copiar con mi link
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => toast.success("Descarga iniciada")}
                  >
                    {a.tipo === "IMAGEN" ? (
                      <ImageIcon className="size-4" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    Descargar
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FiltroPill({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
        activo
          ? "border-verde bg-verde-claro text-verde-oscuro"
          : "border-border bg-background text-gris hover:text-negro",
      )}
    >
      {children}
    </button>
  );
}
