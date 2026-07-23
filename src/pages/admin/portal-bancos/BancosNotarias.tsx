import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollText, Mail, Phone, MapPin, User, Search, Loader2 } from "lucide-react";
import { useNotariasBancos } from "@/hooks/usePortalBancos/useNotariasBancos";

/**
 * Directorio de notarías con las que SOZU trabaja (activas · habilitadas SOZU).
 * Solo datos de contacto, lectura. Visible para todos los roles del Portal Bancos.
 */
export function BancosNotarias() {
  const { data: notarias = [], isLoading } = useNotariasBancos();
  const [q, setQ] = useState("");

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return notarias;
    return notarias.filter((n) =>
      [n.notaria, n.nombre, n.email, n.telefono, n.direccion]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(t)),
    );
  }, [notarias, q]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Notarías</h1>
        <p className="text-sm text-muted-foreground">
          Notarías con las que SOZU trabaja. Datos de contacto.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por notaría, titular, correo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando notarías…
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <ScrollText className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            {notarias.length === 0
              ? "No hay notarías activas registradas."
              : "Sin resultados para tu búsqueda."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {filtradas.length} {filtradas.length === 1 ? "notaría" : "notarías"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtradas.map((n) => (
              <Card key={n.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="h-9 w-9 rounded-md bg-primary/[0.08] text-primary flex items-center justify-center shrink-0">
                      <ScrollText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug">{n.notaria}</p>
                      {n.nombre && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3 shrink-0" /> {n.nombre}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[13px]">
                    {n.telefono ? (
                      <a
                        href={`tel:${n.telefono}`}
                        className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{n.telefono}</span>
                      </a>
                    ) : null}
                    {n.email ? (
                      <a
                        href={`mailto:${n.email}`}
                        className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{n.email}</span>
                      </a>
                    ) : null}
                    {n.direccion ? (
                      <p className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{n.direccion}</span>
                      </p>
                    ) : null}
                    {!n.telefono && !n.email && !n.direccion && (
                      <p className="text-xs text-muted-foreground italic">Sin datos de contacto registrados.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default BancosNotarias;
