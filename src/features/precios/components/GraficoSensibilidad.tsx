/** Gráfico de líneas de sensibilidad a la tasa de descuento (SVG plano). */

export interface SerieSensibilidad {
  nombre: string;
  color: string;
  puntos: Array<{ tasa: number; valor: number }>;
}

export function GraficoSensibilidad({
  series,
  tasaVigente,
  etiquetaY,
}: {
  series: SerieSensibilidad[];
  tasaVigente: number;
  etiquetaY: string;
}) {
  if (series.length === 0) return null;

  const w = 680;
  const h = 300;
  const izq = 62;
  const der = 18;
  const arriba = 16;
  const abajo = 40;

  const tasas = series[0]!.puntos.map((p) => p.tasa);
  const minX = Math.min(...tasas);
  const maxX = Math.max(...tasas);
  const valores = series.flatMap((s) => s.puntos.map((p) => p.valor));
  const minY = Math.min(0, ...valores);
  const maxY = Math.max(...valores, minY + 0.0001);

  const x = (t: number) => izq + ((t - minX) / (maxX - minX || 1)) * (w - izq - der);
  const y = (v: number) => h - abajo - ((v - minY) / (maxY - minY || 1)) * (h - arriba - abajo);

  const marcasY = Array.from({ length: 5 }, (_, i) => minY + ((maxY - minY) * i) / 4);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ height: h }}
        className="w-full min-w-[560px]"
        role="img"
        aria-label={`Sensibilidad: ${etiquetaY} por tasa de descuento anual`}
      >
        {marcasY.map((v, i) => (
          <g key={`y-${i}`}>
            <line x1={izq} x2={w - der} y1={y(v)} y2={y(v)} stroke="#ededed" strokeWidth={1} />
            <text
              x={izq - 8}
              y={y(v) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {(v * 100).toFixed(1)}%
            </text>
          </g>
        ))}

        {tasas.map((t) => (
          <text
            key={`x-${t}`}
            x={x(t)}
            y={h - abajo + 16}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] tabular-nums"
          >
            {(t * 100).toFixed(0)}%
          </text>
        ))}

        <line x1={izq} x2={w - der} y1={h - abajo} y2={h - abajo} stroke="#d4d4d4" strokeWidth={1} />
        <line x1={izq} x2={izq} y1={arriba} y2={h - abajo} stroke="#d4d4d4" strokeWidth={1} />

        <line
          x1={x(tasaVigente)}
          x2={x(tasaVigente)}
          y1={arriba}
          y2={h - abajo}
          stroke="#d97706"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text
          x={x(tasaVigente) + 4}
          y={arriba + 10}
          className="fill-amber-600 text-[10px] tabular-nums"
        >
          {(tasaVigente * 100).toFixed(2)}% vigente
        </text>

        {series.map((s) => (
          <g key={s.nombre}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              points={s.puntos.map((p) => `${x(p.tasa)},${y(p.valor)}`).join(" ")}
            />
            {s.puntos.map((p) => (
              <circle key={p.tasa} cx={x(p.tasa)} cy={y(p.valor)} r={2.5} fill={s.color} />
            ))}
          </g>
        ))}

        <text
          x={izq}
          y={h - 6}
          className="fill-muted-foreground text-[10px]"
        >
          Tasa anual · {etiquetaY}
        </text>
      </svg>
    </div>
  );
}

export const COLORES_SERIE = [
  "#046c4e",
  "#059669",
  "#57ae75",
  "#8bc7a3",
  "#575757",
  "#9a9a9a",
  "#c4c4c4",
];
