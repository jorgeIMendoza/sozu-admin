import { useMemo, useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PROPIEDADES } from "../mocks/inventario";
import { sembrarBitacoraDemo } from "../lib/semillaBitacora";
import { useDemoStore } from "../stores/demoStore";
import { useListaStore } from "../stores/listaStore";
import { useMotorStore } from "../stores/motorStore";

/** Herramientas de demostración. Solo se monta bajo import.meta.env.DEV. */
export function PanelDemoPrecios() {
  const [abierto, setAbierto] = useState(false);
  const idProyectoActivo = useMotorStore((s) => s.idProyectoActivo);
  const setProyectoActivo = useMotorStore((s) => s.setProyectoActivo);
  const resetMotor = useMotorStore((s) => s.reset);
  const resetLista = useListaStore((s) => s.reset);
  const aplicarOverride = useListaStore((s) => s.aplicarOverride);
  const regenerar = useDemoStore((s) => s.regenerar);
  const setCriticas = useDemoStore((s) => s.setCriticas);
  const criticas = useDemoStore((s) => s.criticasForzadas);
  const [sembrando, setSembrando] = useState(false);

  const propsProyecto = useMemo(
    () => PROPIEDADES.filter((p) => p.activo && p.id_proyecto === idProyectoActivo),
    [idProyectoActivo],
  );

  const acciones: Array<[string, () => void]> = [
    ["Regenerar inventario mock", () => regenerar()],
    [
      "Restablecer todos los stores",
      () => {
        resetMotor();
        resetLista();
        setCriticas([]);
      },
    ],
    [
      "Inyectar 10 overrides de ejemplo",
      () => {
        propsProyecto.slice(0, 10).forEach((p, i) => {
          const precio =
            Math.round(p.precio_lista_actual * (1 + (i % 5) * 0.01)) || 5000000;
          aplicarOverride(
            p.id_propiedad,
            precio,
            "Instrucción del desarrollador",
            "Override de demostración generado por las herramientas internas de prueba.",
            precio,
          );
        });
      },
    ],
    [
      sembrando ? "Sembrando eventos…" : "Sembrar 25 eventos de bitácora",
      () => {
        if (sembrando) return;
        setSembrando(true);
        sembrarBitacoraDemo(idProyectoActivo).finally(() => setSembrando(false));
      },
    ],
    [
      criticas.length > 0 ? "Quitar alertas críticas forzadas" : "Forzar alertas críticas en 5 unidades",
      () =>
        setCriticas(
          criticas.length > 0
            ? []
            : propsProyecto.slice(10, 15).map((p) => p.id_propiedad),
        ),
    ],
    [
      "Alternar proyecto activo (Daiku ↔ Monócolo)",
      () =>
        setProyectoActivo(
          idProyectoActivo === "pry-daiku" ? "pry-monocolo" : "pry-daiku",
        ),
    ],
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {abierto && (
        <Card className="w-72 gap-2 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-muted-foreground">
              Herramientas de demostración
            </p>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => setAbierto(false)}>
              <X className="size-3.5" />
            </Button>
          </div>
          {acciones.map(([titulo, fn]) => (
            <Button
              key={titulo}
              variant="outline"
              size="sm"
              className="justify-start text-left text-xs"
              onClick={fn}
            >
              {titulo}
            </Button>
          ))}
        </Card>
      )}
      <Button
        variant="outline"
        size="icon"
        className="size-9 rounded-full shadow-sm"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Herramientas de demostración"
      >
        <FlaskConical className="size-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
