import { useRef, useState } from "react";

/**
 * Gráfico de línea en SVG plano, sin librerías externas.
 *
 * Lee el mouse para responder: al pasar por encima marca el punto más cercano y
 * abre una etiqueta con sus dos valores exactos. Sin eso, una curva en pesos
 * abreviados —"$1.85 M"— obliga a bajar a la tabla para saber de cuánto se
 * habla, y el punto que interesa casi nunca es el que está tabulado.
 */
export function GraficoCurva({
  puntos,
  etiquetaX,
  etiquetaY,
  formatoValor = (v: number) => v.toFixed(4),
  formatoDetalle,
  formatoX = (v: number) => String(v),
  referencia,
  etiquetaReferencia,
  lineaBase = 1,
}: {
  puntos: Array<{ x: number; y: number }>;
  etiquetaX: string;
  etiquetaY: string;
  formatoValor?: (v: number) => string;
  /**
   * Cómo se lee el valor en la etiqueta del mouse. Por omisión, igual que en
   * el eje; se separa para que el eje pueda ir abreviado —"$1.85 M", que es lo
   * único que cabe— y el detalle exacto aparezca al pasar por encima.
   */
  formatoDetalle?: (v: number) => string;
  /** Cómo se lee el eje X en los ticks y en la etiqueta del mouse. */
  formatoX?: (v: number) => string;
  /** Curva comparativa opcional, dibujada punteada detrás de la principal. */
  referencia?: Array<{ x: number; y: number }>;
  etiquetaReferencia?: string;
  /**
   * Valor neutro del eje Y: se dibuja punteado y el eje siempre lo incluye.
   * Vale 1 porque el gráfico nació para multiplicadores, donde 1 es "sin
   * efecto". Para una serie en pesos hay que pasar `null`: forzar el 1 dentro
   * del rango aplastaría la curva contra el borde superior.
   */
  lineaBase?: number | null;
}) {
  const w = 520;
  const h = 220;
  const svgRef = useRef<SVGSVGElement>(null);
  const [activo, setActivo] = useState<number | null>(null);

  if (puntos.length < 2) return null;

  const xs = puntos.map((p) => p.x);
  const ys = [...puntos.map((p) => p.y), ...(referencia ?? []).map((p) => p.y)];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const neutro = lineaBase == null ? [] : [lineaBase];
  const minY = Math.min(...ys, ...neutro);
  const maxY = Math.max(...ys, ...neutro);
  const spanY = maxY - minY || 1;

  // El margen izquierdo se ajusta a la etiqueta más larga: "1.0250" y
  // "$1.85 M" caben en 52px, "$12,345,678.90" no, y se encimaría con la curva.
  // El inferior deja dos renglones: los valores del eje y su nombre.
  const ticksY = [minY, minY + spanY / 2, maxY];
  const anchoEtiqueta = Math.max(...ticksY.map((t) => formatoValor(t).length));
  const m = { top: 14, right: 14, bottom: 42, left: Math.max(52, anchoEtiqueta * 6 + 12) };
  const anchoTrazo = w - m.left - m.right;
  const altoTrazo = h - m.top - m.bottom;

  // Redondeo explícito: sin él, la última cifra del float difiere entre el
  // render del servidor y el del navegador y React reporta hydration mismatch.
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const px = (x: number) => r3(m.left + ((x - minX) / (maxX - minX || 1)) * anchoTrazo);
  const py = (y: number) => r3(m.top + (1 - (y - minY) / spanY) * altoTrazo);

  const d = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.x)},${py(p.y)}`).join(" ");
  const dRef = (referencia ?? [])
    .map((p, i) => `${i === 0 ? "M" : "L"}${px(p.x)},${py(p.y)}`)
    .join(" ");

  /*
   * Tres marcas en el eje X: extremos y medio. Con una por punto se encimarían
   * —hay curvas de 21 puntos en 450px—, y con ninguna no se sabe si el eje va
   * del nivel 1 al 17 o del 40 al 300.
   */
  const ticksX = [puntos[0]!, puntos[Math.floor((puntos.length - 1) / 2)]!, puntos[puntos.length - 1]!];

  /**
   * Punto más cercano al mouse.
   *
   * Se busca por X y no por distancia euclidiana: el gesto es "qué pasa en este
   * nivel", no "qué punto está más cerca del cursor". El SVG escala con el
   * contenedor, así que la coordenada del evento hay que llevarla a las unidades
   * del viewBox antes de comparar.
   */
  const alMover = (e: React.MouseEvent<SVGSVGElement>) => {
    const caja = svgRef.current?.getBoundingClientRect();
    if (!caja || caja.width === 0) return;
    const xv = (e.clientX - caja.left) * (w / caja.width);
    let mejor = 0;
    let mejorDist = Infinity;
    for (let i = 0; i < puntos.length; i++) {
      const dist = Math.abs(px(puntos[i]!.x) - xv);
      if (dist < mejorDist) {
        mejorDist = dist;
        mejor = i;
      }
    }
    setActivo(mejor);
  };

  const p = activo == null ? null : puntos[activo]!;
  const pRef = activo == null ? null : (referencia ?? [])[activo];

  // La etiqueta se voltea al acercarse al borde derecho, y sube o baja para no
  // salirse: una etiqueta cortada es peor que no tenerla.
  const detalle = formatoDetalle ?? formatoValor;
  const lineas = p
    ? [
        `${etiquetaX} ${formatoX(p.x)}`,
        detalle(p.y),
        ...(pRef ? [`Referencia: ${detalle(pRef.y)}`] : []),
      ]
    : [];
  const anchoCaja = Math.max(...lineas.map((t) => t.length), 0) * 5.6 + 16;
  const altoCaja = lineas.length * 13 + 10;
  const cajaX = p
    ? px(p.x) + 12 + anchoCaja > w - m.right
      ? px(p.x) - 12 - anchoCaja
      : px(p.x) + 12
    : 0;
  const cajaY = p ? Math.min(Math.max(py(p.y) - altoCaja / 2, m.top), h - m.bottom - altoCaja) : 0;

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="h-[220px] w-full"
        role="img"
        aria-label={`Curva de ${etiquetaY} contra ${etiquetaX}`}
        onMouseMove={alMover}
        onMouseLeave={() => setActivo(null)}
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
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {formatoValor(t)}
            </text>
          </g>
        ))}

        {ticksX.map((t, i) => (
          <text
            key={`${t.x}-${i}`}
            x={px(t.x)}
            y={h - m.bottom + 15}
            textAnchor={i === 0 ? "start" : i === ticksX.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground text-[10px] tabular-nums"
          >
            {formatoX(t.x)}
          </text>
        ))}

        {lineaBase == null ? null : (
          <line
            x1={m.left}
            x2={w - m.right}
            y1={py(lineaBase)}
            y2={py(lineaBase)}
            className="stroke-muted-foreground/50"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
        )}
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

        {/* Los puntos se dibujan chicos para no ensuciar la curva; el detalle
            aparece al pasar el mouse. El <title> da además el tooltip nativo,
            que es lo único que ve un lector de pantalla. */}
        {puntos.map((punto, i) => (
          <circle
            key={`${punto.x}-${i}`}
            cx={px(punto.x)}
            cy={py(punto.y)}
            r={activo === i ? 4.5 : 2.5}
            className={activo === i ? "fill-primary stroke-background" : "fill-primary"}
            strokeWidth={activo === i ? 1.5 : 0}
          >
            <title>{`${etiquetaX} ${formatoX(punto.x)} · ${detalle(punto.y)}`}</title>
          </circle>
        ))}

        {p ? (
          <>
            <line
              x1={px(p.x)}
              x2={px(p.x)}
              y1={m.top}
              y2={h - m.bottom}
              className="stroke-muted-foreground/40"
              strokeWidth={1}
            />
            <g>
              <rect
                x={cajaX}
                y={cajaY}
                width={anchoCaja}
                height={altoCaja}
                rx={4}
                className="fill-popover stroke-border"
                strokeWidth={1}
              />
              {lineas.map((t, i) => (
                <text
                  key={t}
                  x={cajaX + 8}
                  y={cajaY + 17 + i * 13}
                  className={
                    i === 0
                      ? "fill-muted-foreground text-[10px]"
                      : "fill-foreground text-[11px] font-medium tabular-nums"
                  }
                >
                  {t}
                </text>
              ))}
            </g>
          </>
        ) : null}

        <text
          x={m.left + anchoTrazo / 2}
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
