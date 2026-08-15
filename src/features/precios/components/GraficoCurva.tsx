/** Gráfico de línea en SVG plano, sin librerías externas. */
export function GraficoCurva({
  puntos,
  etiquetaX,
  etiquetaY,
  formatoValor = (v: number) => v.toFixed(4),
  referencia,
  etiquetaReferencia,
}: {
  puntos: Array<{ x: number; y: number }>;
  etiquetaX: string;
  etiquetaY: string;
  formatoValor?: (v: number) => string;
  /** Curva comparativa opcional, dibujada punteada detrás de la principal. */
  referencia?: Array<{ x: number; y: number }>;
  etiquetaReferencia?: string;
}) {
  const w = 520;
  const h = 200;
  const m = { top: 12, right: 12, bottom: 26, left: 52 };

  if (puntos.length < 2) return null;

  const xs = puntos.map((p) => p.x);
  const ys = [...puntos.map((p) => p.y), ...(referencia ?? []).map((p) => p.y)];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys, 1);
  const maxY = Math.max(...ys, 1);
  const spanY = maxY - minY || 1;

  // Redondeo explícito: sin él, la última cifra del float difiere entre el
  // render del servidor y el del navegador y React reporta hydration mismatch.
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const px = (x: number) =>
    r3(m.left + ((x - minX) / (maxX - minX || 1)) * (w - m.left - m.right));
  const py = (y: number) =>
    r3(m.top + (1 - (y - minY) / spanY) * (h - m.top - m.bottom));

  const d = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.x)},${py(p.y)}`).join(" ");
  const dRef = (referencia ?? [])
    .map((p, i) => `${i === 0 ? "M" : "L"}${px(p.x)},${py(p.y)}`)
    .join(" ");
  const ticksY = [minY, minY + spanY / 2, maxY];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[200px] w-full min-w-[420px]"
        role="img"
        aria-label={`Curva de ${etiquetaY} contra ${etiquetaX}`}
      >
        {ticksY.map((t) => (
          <g key={t}>
            <line
              x1={m.left}
              x2={w - m.right}
              y1={py(t)}
              y2={py(t)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={m.left - 6}
              y={py(t) + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {formatoValor(t)}
            </text>
          </g>
        ))}
        <line
          x1={m.left}
          x2={w - m.right}
          y1={py(1)}
          y2={py(1)}
          className="stroke-muted-foreground/50"
          strokeDasharray="4 3"
          strokeWidth={1}
        />
        {dRef ? (
          <path
            d={dRef}
            fill="none"
            className="stroke-muted-foreground"
            strokeDasharray="5 4"
            strokeWidth={1.5}
          />
        ) : null}
        <path d={d} fill="none" className="stroke-primary" strokeWidth={2} />
        {puntos.map((p) => (
          <circle key={p.x} cx={px(p.x)} cy={py(p.y)} r={2.5} className="fill-primary" />
        ))}
        <text
          x={(w + m.left) / 2}
          y={h - 6}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          {etiquetaX}
        </text>
      </svg>
      {etiquetaReferencia ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Línea punteada: {etiquetaReferencia}
        </p>
      ) : null}
    </div>
  );
}
