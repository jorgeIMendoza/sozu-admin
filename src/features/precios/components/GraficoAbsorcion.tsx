/** Barras de unidades vendidas por mes y línea de valor presente acumulado (SVG plano). */
export function GraficoAbsorcion({
  meses,
}: {
  meses: Array<{ mes: number; unidades: number; vpAcumulado: number }>;
}) {
  if (meses.length === 0) return null;

  const w = 680;
  const h = 260;
  const izq = 34;
  const der = 60;
  const arriba = 14;
  const abajo = 34;

  const maxU = Math.max(...meses.map((m) => m.unidades), 1);
  const maxV = Math.max(...meses.map((m) => m.vpAcumulado), 1);
  const paso = (w - izq - der) / meses.length;
  const ancho = Math.max(3, Math.min(24, paso * 0.7));
  const alto = h - arriba - abajo;
  const salto = meses.length > 18 ? 3 : meses.length > 10 ? 2 : 1;

  const x = (i: number) => izq + paso * (i + 0.5);
  const yU = (u: number) => arriba + alto - (u / maxU) * alto;
  const yV = (v: number) => arriba + alto - (v / maxV) * alto;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ height: h }}
        className="w-full min-w-[560px]"
        role="img"
        aria-label="Unidades vendidas por mes y valor presente acumulado"
      >
        <line
          x1={izq}
          x2={w - der}
          y1={arriba + alto}
          y2={arriba + alto}
          stroke="#d4d4d4"
          strokeWidth={1}
        />
        {meses.map((m, i) => (
          <g key={m.mes}>
            <rect
              x={x(i) - ancho / 2}
              y={yU(m.unidades)}
              width={ancho}
              height={Math.max(1, arriba + alto - yU(m.unidades))}
              rx={2}
              fill="#8bc7a3"
            />
            {i % salto === 0 ? (
              <text
                x={x(i)}
                y={h - 14}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {m.mes}
              </text>
            ) : null}
          </g>
        ))}

        <polyline
          fill="none"
          stroke="#046c4e"
          strokeWidth={2}
          points={meses.map((m, i) => `${x(i)},${yV(m.vpAcumulado)}`).join(" ")}
        />

        <text
          x={izq}
          y={arriba - 2}
          className="fill-muted-foreground text-[10px]"
        >
          Unidades / mes
        </text>
        <text
          x={w - der + 6}
          y={yV(meses[meses.length - 1]!.vpAcumulado) + 4}
          className="fill-emerald-800 text-[10px]"
        >
          VP acum.
        </text>
        <text
          x={w / 2}
          y={h - 2}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          Mes de venta
        </text>
      </svg>
    </div>
  );
}
