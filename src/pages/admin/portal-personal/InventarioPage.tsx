import {Link} from "react-router-dom";
import { useState } from "react";
import { Building2, Eye, MapPin, Search, Share2 } from "lucide-react";
import { toast } from "sonner";
import { mxn, selectores } from "@/lib/portal-personal/selectores";
import { usePortal } from "@/lib/portal-personal/portal-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EstadoCargaTarjetas,
  EstadoError,
  EstadoVacio,
} from "@/components/admin/portal-personal/comunes/Estados";


export default function InventarioPage() {
  const [q, setQ] = useState("");
  const usuario = usePortal((s) => s.usuario);
  const carga = usePortal((s) => s.carga);
  const setCarga = usePortal((s) => s.setCarga);
  const registrarLog = usePortal((s) => s.registrarLog);

  // SWAP POINT: supabase.desarrollos
  const todos = selectores.desarrollos();
  const termino = q.trim().toLowerCase();
  const desarrollos = todos.filter(
    (d) =>
      d.nombre.toLowerCase().includes(termino) ||
      d.direccion.toLowerCase().includes(termino),
  );

  async function compartir(nombre: string, slug: string) {
    // SWAP POINT: supabase.desarrollos (link público + código de referido)
    const link = `https://sozu.com/d/${slug}?ref=${usuario.codigo_referido}`;
    try {
      await navigator.clipboard.writeText(link);
      registrarLog("compartir_desarrollo", `${nombre} · link con código ${usuario.codigo_referido}`);
      toast.success("Link copiado con tu código de referido");
    } catch {
      toast.error("No pudimos copiar el link");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gris" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar desarrollo..."
          className="h-11 bg-background pl-9"
        />
      </div>

      {carga === "cargando" ? (
        <EstadoCargaTarjetas />
      ) : carga === "error" ? (
        <EstadoError onReintentar={() => setCarga("listo")} />
      ) : todos.length === 0 ? (
        <EstadoVacio
          icono={Building2}
          titulo="Aún no hay desarrollos disponibles"
          descripcion="En cuanto se libere inventario lo verás aquí."
        />
      ) : desarrollos.length === 0 ? (
        <EstadoVacio
          icono={Building2}
          titulo="Sin resultados"
          descripcion="No encontramos desarrollos con ese nombre o dirección. Prueba con otra búsqueda."
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
          {desarrollos.map((d) => (
            <article key={d.id} className="card-sozu flex h-full flex-col overflow-hidden">
              <div className="relative">
                <img
                  src={d.imagen}
                  alt={`Fachada de ${d.nombre}`}
                  loading="lazy"
                  width={1024}
                  height={640}
                  className="aspect-[16/9] w-full rounded-t-xl object-cover"
                />
                <span className="num absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-verde px-3 py-1 text-xs font-semibold text-white">
                  <span className="size-1.5 rounded-full bg-white" />
                  {d.disponibles} disponibles
                </span>
              </div>

              <div className="space-y-3 p-5">
                <h3 className="text-xl font-bold text-negro">{d.nombre}</h3>
                <p className="flex items-center gap-1.5 truncate text-sm text-gris">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="truncate">{d.direccion}</span>
                </p>
                <p className="num text-base font-bold text-verde">
                  Desde {mxn(d.precio_desde)}
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <p className="eyebrow text-gris">Total unidades</p>
                    <p className="num mt-0.5 text-sm font-bold text-negro">
                      {d.total_unidades}
                    </p>
                  </div>
                  <div>
                    <p className="eyebrow text-gris">Avance</p>
                    <p className="num mt-0.5 text-sm font-bold text-negro">
                      {d.avance_obra}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-border p-4">
                <Button asChild variant="outline" className="flex-1">
                  <Link to={`/admin/portal-personal/inventario/${d.slug}`}>
                    <Eye className="size-4" />
                    Ver
                  </Link>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <Link to={`/admin/portal-personal/inventario/${d.slug}`}>
                    <Building2 className="size-4" />
                    Inventario
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-verde text-verde-oscuro"
                  aria-label={`Compartir ${d.nombre}`}
                  onClick={() => void compartir(d.nombre, d.slug)}
                >
                  <Share2 className="size-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
