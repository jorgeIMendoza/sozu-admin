import { useMemo, useState } from "react";
import { formatoMoneda } from "../lib/formato";

export interface PuntoDispersion {
  id_propiedad: string;
  numero: string;
  observado: number;
  predicho: number;
  sigmas: number;
}

const ANCHO = 640;
const ALTO = 400;
const MARGEN = { top: 16, right: 16, bottom: 44, left: 76 };

function abreviar(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

/**
 * Dispersión observado vs. predicho en SVG plano, sin librerías.
 */
export function GraficoDispersion({
  puntos,
  umbralSigma,
  onSeleccionar,
}: {
  puntos: PuntoDispersion[];
  umbralSigma: number;
  onSeleccionar: (idPropiedad: string) => void;
}) {
  const [activo, setActivo] = useState<PuntoDispersion | null>(null);

  const { min, max } = useMemo(() => {
    const valores = puntos.flatMap((p) => [p.observado, p.predicho]);
    const lo = Math.min(...valores);
    const hi = Math.max(...valores);
    const margen = (hi - lo) * 0.05 || 1;
    return { min: lo - margen, max: hi + margen };
  }, [puntos]);

  if (puntos.length === 0) return null;

  const anchoUtil = ANCHO - MARGEN.left - MARGEN.right;
  const altoUtil = ALTO - MARGEN.top - MARGEN.bottom;
  const px = (v: number) => MARGEN.left + ((v - min) / (max - min)) * anchoUtil;
  const py = (v: number) => MARGEN.top + altoUtil - ((v - min) / (max - min)) * altoUtil;

  const marcas = [0, 0.25, 0.5, 0.75, 1].map((t) => min + t * (max - min));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="w-full max-w-[640px]"
        role="img"
        aria-label="Dispersión de precio observado contra precio predicho"
      >
        {marcas.map((m) => (
          <g key={`gx-${m}`}>
            <line
              x1={MARGEN.left}
              x2={ANCHO - MARGEN.right}
              y1={py(m)}
              y2={py(m)}
              stroke="currentColor"
              className="text-border"
              strokeWidth={1}
            />
            <text
              x={MARGEN.left - 8}
              y={py(m) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {abreviar(m)}
            </text>
            <text
              x={px(m)}
              y={ALTO - MARGEN.bottom + 18}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {abreviar(m)}
            </text>
          </g>
        ))}

        <line
          x1={px(min)}
          y1={py(min)}
          x2={px(max)}
          y2={py(max)}
          stroke="currentColor"
          strokeDasharray="4 4"
          className="text-muted-foreground"
          strokeWidth={1}
        />

        {puntos.map((p) => {
          const atipico = Math.abs(p.sigmas) > umbralSigma;
          return (
            <circle
              key={p.id_propiedad}
              cx={px(p.observado)}
              cy={py(p.predicho)}
              r={4}
              fill={atipico ? "#d97706" : "#059669"}
              fillOpacity={atipico ? 1 : 0.6}
              className="cursor-pointer"
              onMouseEnter={() => setActivo(p)}
              onMouseLeave={() => setActivo(null)}
              onClick={() => onSeleccionar(p.id_propiedad)}
            />
          );
        })}

        <text
          x={MARGEN.left + anchoUtil / 2}
          y={ALTO - 6}
          textAnchor="middle"
          className="fill-muted-foreground text-[11px]"
        >
          Precio exento observado
        </text>
        <text
          x={14}
          y={MARGEN.top + altoUtil / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${MARGEN.top + altoUtil / 2})`}
          className="fill-muted-foreground text-[11px]"
        >
          Precio exento predicho
        </text>
      </svg>

      {activo && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-border bg-background p-2 text-xs shadow-sm">
          <p className="font-semibold text-foreground tabular-nums">
            Unidad {activo.numero}
          </p>
          <p className="text-muted-foreground tabular-nums">
            Observado: {formatoMoneda(activo.observado)}
          </p>
          <p className="text-muted-foreground tabular-nums">
            Predicho: {formatoMoneda(activo.predicho)}
          </p>
          <p className="text-muted-foreground tabular-nums">
            Residual: {formatoMoneda(activo.observado - activo.predicho)} ·{" "}
            {activo.sigmas.toFixed(2)} σ
          </p>
        </div>
      )}

      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
        <p>
          Cada punto es una unidad. La diagonal punteada representa el ajuste perfecto:
          mientras más cerca de la línea, mejor reproduce el modelo el precio asignado.
        </p>
        <p>
          Verde: unidad dentro del umbral. Ámbar: valor atípico por encima de{" "}
          {umbralSigma.toFixed(1)} desviaciones estándar.
        </p>
      </div>
    </div>
  );
}
