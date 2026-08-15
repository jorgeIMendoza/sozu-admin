import type { FlujoMensual } from "../types/dominio";

/**
 * Barras del calendario en SVG plano: serie nominal (verde claro) y serie de
 * valor presente (esmeralda). La diferencia es el costo del diferimiento.
 */
export function GraficoCalendario({
  flujos,
  horizonte,
}: {
  flujos: FlujoMensual[];
  horizonte: number;
}) {
  const w = 560;
  const h = 190;
  const m = { top: 12, right: 10, bottom: 30, left: 10 };
  const meses = Math.max(1, horizonte);
  const porMes = new Map<number, { pct: number; vp: number }>();
  for (const f of flujos) {
    const prev = porMes.get(f.mes) ?? { pct: 0, vp: 0 };
    porMes.set(f.mes, {
      pct: prev.pct + f.pct,
      vp: prev.vp + (f.valor_presente ?? 0),
    });
  }
  const maxPct = Math.max(...[...porMes.values()].map((v) => v.pct), 0.01);
  const anchoTotal = w - m.left - m.right;
  const paso = anchoTotal / (meses + 1);
  const anchoBarra = Math.max(4, Math.min(26, paso * 0.66));
  const alto = h - m.top - m.bottom;
  const saltoEtiqueta = meses > 18 ? 3 : meses > 10 ? 2 : 1;

  // Curva de acumulación: qué porcentaje del precio lleva pagado el comprador
  // en cada mes. Es la lectura que importa en una mesa de ventas.
  let acumulado = 0;
  const puntosAcum: Array<{ x: number; y: number }> = [];
  for (let mes = 0; mes <= meses; mes++) {
    acumulado += porMes.get(mes)?.pct ?? 0;
    puntosAcum.push({
      x: m.left + paso * (mes + 0.5),
      y: m.top + alto - acumulado * alto,
    });
  }
  const dAcum = puntosAcum
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[190px] w-full min-w-[420px]"
        role="img"
        aria-label="Calendario de flujos nominal y valor presente"
      >
        <line
          x1={m.left}
          x2={w - m.right}
          y1={m.top + alto}
          y2={m.top + alto}
          className="stroke-border"
          strokeWidth={1}
        />
        {Array.from({ length: meses + 1 }, (_, mes) => {
          const v = porMes.get(mes);
          const cx = m.left + paso * (mes + 0.5);
          const hNom = v ? (v.pct / maxPct) * alto : 0;
          const hVp = v ? (v.vp / maxPct) * alto : 0;
          return (
            <g key={mes}>
              {v ? (
                <>
                  <rect
                    x={cx - anchoBarra / 2}
                    y={m.top + alto - hNom}
                    width={anchoBarra}
                    height={hNom}
                    fill="#a7e0bd"
                    rx={2}
                  />
                  <rect
                    x={cx - anchoBarra / 4}
                    y={m.top + alto - hVp}
                    width={anchoBarra / 2}
                    height={hVp}
                    fill="#059669"
                    rx={2}
                  />
                </>
              ) : null}
              {mes % saltoEtiqueta === 0 ? (
                <text
                  x={cx}
                  y={h - 14}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] tabular-nums"
                >
                  {mes}
                </text>
              ) : null}
            </g>
          );
        })}
        <path d={dAcum} fill="none" stroke="#0f766e" strokeWidth={1.75} strokeDasharray="5 4" />
        {puntosAcum.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.8} fill="#0f766e" />
        ))}
        <text
          x={w / 2}
          y={h - 2}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          Mes
        </text>
      </svg>
      <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm" style={{ background: "#a7e0bd" }} />
          Flujo nominal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm" style={{ background: "#059669" }} />
          Valor presente
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4"
            style={{ background: "#0f766e" }}
          />
          Acumulado del precio (0% a 100%)
        </span>
      </div>
    </div>
  );
}
