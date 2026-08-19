import { useEffect, useMemo, useState } from "react";
import { Building2, Maximize2, MapPin } from "lucide-react";
import { FloorPlanCanvas } from "@/components/admin/PlanosPropertyModal";
import {
  filasEdificio,
  parseNivel,
  posicionEnNivel,
  resolveTotalNiveles,
  unidadSigueConvencion,
} from "@/lib/offers/unit-location";
import FullscreenModal from "./FullscreenModal";
import SectionCard from "./SectionCard";

/**
 * "Ubicación de tu departamento en el proyecto" — sección de la oferta digital.
 *
 * Réplica web del `BuildingDiagram` de la app del cliente
 * (sozu-cliente-app/lib/features/client/properties/components/building_diagram.dart):
 * corte del edificio con el ducto del elevador a la izquierda y la planta del
 * nivel a la derecha. El carro sube desde planta baja hasta el nivel de la
 * unidad y, al llegar, la losa se pinta de verde, "respira" y aparece "◄ Tú".
 *
 * Diferencias deliberadas con la app:
 * - La planta usa `FloorPlanCanvas` (imagen del nivel + regiones encima), que es
 *   lo que ya ve el cliente en la web; la app dibuja solo los polígonos.
 * - Sin imagen ni regiones se cae a la rejilla de unidades, igual que la app,
 *   para que la columna derecha nunca quede vacía.
 *
 * El piso solo llega aquí si la oferta tiene `mostrar_piso_en_oferta`: sin
 * `level` la sección no se monta (ver use-offer-db).
 */

interface Props {
  /** `numero_piso` de la propiedad. Llega como string ('11', 'PB') desde la BD. */
  level?: number | string;
  /** `edificios.numero_pisos`. Sin él el corte se dibuja hasta el nivel de la unidad. */
  totalPisos?: number;
  /** Número completo de la propiedad (ej. '709'). */
  unitNumber: string;
  /** Depto derivado (ej. '09') para el match del resaltado. */
  unitDepto?: string;
  /** Área de la unidad ya formateada (ej. '38.60 m²'). */
  area?: string;
  planoUbicacionUrl?: string;
  planoUbicacionRegiones?: any[];
}

// Geometría del corte. Las alturas se comparten entre losas y ducto para que el
// carro se alinee exacto con cada nivel.
const ROW_H = 26;
const ROW_GAP = 5;
const ROOF_H = 20;
const BASE_GAP = 3;
const BASE_H = 9;
const WALL_W = 6;
const SHAFT_W = 20;
const SHAFT_GAP = 3;
const ARROW_W = 26;
const BUILDING_W = 140;
const CAR_H = 20;
const SALTO_H = 18;

const SUBIDA_MS = 3200;

const OfferUnitLocation = ({
  level,
  totalPisos,
  unitNumber,
  unitDepto,
  area,
  planoUbicacionUrl,
  planoUbicacionRegiones,
}: Props) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const nivel = parseNivel(level);
  const hasRegiones = Array.isArray(planoUbicacionRegiones) && planoUbicacionRegiones.length > 0;

  // Sin nivel no hay nada que ubicar: el corte del edificio y la planta se
  // resuelven ambos a partir del piso.
  if (nivel == null) return null;

  const total = resolveTotalNiveles(totalPisos, nivel);
  const depto = unitDepto || unitNumber;
  // Sin plano del nivel se puede insinuar el orden de las unidades, pero solo si
  // los vecinos que se pintarían existen de verdad (ver unidadSigueConvencion).
  const puedeDibujarRejilla = !planoUbicacionUrl && unidadSigueConvencion(unitNumber, nivel);

  const resumen = [
    depto ? `Unidad ${depto}` : null,
    `Nivel ${nivel}${total > nivel ? ` de ${total}` : ""}`,
    area || null,
  ].filter(Boolean);

  return (
    <>
      <SectionCard icon={Building2} title="Ubicación de tu departamento">
        <div className="space-y-4">
          <div>
            <p className="text-[13px] text-muted-foreground">
              Dónde queda tu unidad dentro del edificio y de su nivel.
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">
              {resumen.join(" · ")}
            </p>
          </div>

          <div className="grid gap-4 md:gap-6 md:grid-cols-[minmax(0,240px)_1fr] items-start">
            {/* ── Corte del edificio ── */}
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">
                Nivel en el edificio
              </p>
              <div className="rounded-md border border-border bg-background p-3 flex justify-center">
                <BuildingCutaway nivel={nivel} total={total} />
              </div>
            </div>

            {/* ── Planta del nivel ── */}
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-2">
                Ubicación en el nivel
              </p>
              <div className="rounded-md border border-border bg-background p-2">
                {planoUbicacionUrl ? (
                  <button
                    type="button"
                    aria-label="Ampliar la planta del nivel"
                    onClick={() => setLightboxOpen(true)}
                    className="group relative block w-full overflow-hidden rounded cursor-zoom-in"
                  >
                    {hasRegiones ? (
                      <FloorPlanCanvas
                        imageUrl={planoUbicacionUrl}
                        regiones={planoUbicacionRegiones!}
                        highlightUnit={unitDepto ?? ""}
                        fullPropertyNumber={unitNumber}
                      />
                    ) : (
                      <img
                        src={planoUbicacionUrl}
                        alt="Planta del nivel"
                        className="block w-full h-auto"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <span className="absolute top-2 right-2 w-8 h-8 rounded-full bg-card/90 backdrop-blur-md border border-border flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-3.5 h-3.5 text-foreground" />
                    </span>
                  </button>
                ) : puedeDibujarRejilla ? (
                  <UnitGrid nivel={nivel} posicion={posicionEnNivel(unitNumber, nivel)} />
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <MapPin className="w-6 h-6 text-muted-foreground/40" />
                    <p className="text-[12px] text-muted-foreground max-w-[240px] leading-relaxed">
                      Este nivel aún no tiene plano cargado. Tu asesor puede compartirte la
                      distribución del piso.
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                {planoUbicacionUrl
                  ? hasRegiones
                    ? "Planta del nivel · tu unidad resaltada"
                    : "Planta del nivel"
                  : puedeDibujarRejilla
                    ? "Orden de las unidades del nivel · la distribución real puede variar"
                    : "Ubicación en el nivel pendiente de plano"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-block w-3 h-3 rounded-sm bg-primary shrink-0" />
              Tu unidad
            </span>
            {/* Solo con la rejilla: ahí sí aporta (lo dibujado es el orden, no la
                planta). Sin rejilla el propio placeholder ya lo dice. */}
            {puedeDibujarRejilla && (
              <span className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                La planta exacta del nivel se mostrará cuando el proyecto la cargue.
              </span>
            )}
          </div>
        </div>
      </SectionCard>

      <FullscreenModal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        label="Planta del nivel ampliada"
      >
        {planoUbicacionUrl &&
          (hasRegiones ? (
            <div className="w-full max-w-5xl mx-auto [&_canvas]:!w-auto [&_canvas]:max-w-full [&_canvas]:max-h-[85vh] [&_canvas]:mx-auto">
              <FloorPlanCanvas
                imageUrl={planoUbicacionUrl}
                regiones={planoUbicacionRegiones!}
                highlightUnit={unitDepto ?? ""}
                fullPropertyNumber={unitNumber}
              />
            </div>
          ) : (
            <img
              src={planoUbicacionUrl}
              alt="Planta del nivel ampliada"
              className="max-w-full max-h-full object-contain"
            />
          ))}
      </FullscreenModal>
    </>
  );
};

// ── Corte del edificio con elevador ──

/** ¿El visitante pidió menos movimiento? Entonces el carro no viaja. */
function usePrefiereMenosMovimiento(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduce;
}

const BuildingCutaway = ({ nivel, total }: { nivel: number; total: number }) => {
  const sinMovimiento = usePrefiereMenosMovimiento();
  // `subiendo` dispara la transición del carro; `llego` pinta el nivel de verde.
  // Con reduced-motion ambos arrancan en true: el resultado final, sin viaje.
  const [subiendo, setSubiendo] = useState(false);
  const [llego, setLlego] = useState(false);

  useEffect(() => {
    if (sinMovimiento) {
      setSubiendo(true);
      setLlego(true);
      return;
    }
    // El primer frame debe renderizar el carro abajo para que la transición
    // tenga de dónde salir; de ahí el arranque diferido.
    const t1 = window.setTimeout(() => setSubiendo(true), 120);
    const t2 = window.setTimeout(() => setLlego(true), 120 + SUBIDA_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [sinMovimiento]);

  const filas = useMemo(() => filasEdificio(nivel, total), [nivel, total]);

  // Y acumulada: las filas no miden lo mismo (azotea, salto, losa), así que la
  // posición se calcula recorriéndolas en orden. El ducto y el carro usan estas
  // mismas medidas, que es lo que mantiene al elevador clavado en su losa.
  const alto = (f: (typeof filas)[number]) =>
    f.tipo === "azotea" ? ROOF_H : f.tipo === "salto" ? SALTO_H : ROW_H;

  const layout = useMemo(() => {
    let y = 0;
    return filas.map((f) => {
      const gap = f.tipo === "azotea" ? 0 : ROW_GAP;
      const box = { fila: f, y, h: alto(f), cy: y + alto(f) / 2 };
      y += alto(f) + gap;
      return box;
    });
  }, [filas]);

  // El cuerpo (muros y ducto) arranca bajo la azotea y termina con la última fila.
  const primerCuerpo = layout.find((b) => b.fila.tipo !== "azotea")!;
  const ultimo = layout[layout.length - 1];
  const cuerpoTop = primerCuerpo.y;
  const cuerpoBottom = ultimo.y + ultimo.h;
  const baseY = cuerpoBottom + BASE_GAP;
  const svgH = baseY + BASE_H;

  const boxNivel = layout.find((b) => b.fila.tipo === "nivel" && b.fila.n === nivel);
  const boxPlanta = layout.find((b) => b.fila.tipo === "planta-baja")!;
  const yCarroAbajo = boxPlanta.cy - CAR_H / 2;
  const yCarroDestino = (boxNivel ?? boxPlanta).cy - CAR_H / 2;

  const xLosas = WALL_W + SHAFT_W + SHAFT_GAP;
  const wLosas = BUILDING_W - xLosas - WALL_W;

  return (
    <svg
      viewBox={`0 0 ${BUILDING_W + ARROW_W} ${svgH}`}
      className="w-full max-w-[230px]"
      role="img"
      aria-label={`Tu unidad está en el nivel ${nivel}${total > nivel ? ` de ${total}` : ""}`}
    >
      <style>{`
        @keyframes sozuLosaRespira {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.82; }
        }
        .sozu-losa-viva { animation: sozuLosaRespira 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sozu-losa-viva { animation: none; }
        }
      `}</style>

      {/* Muros exteriores en corte */}
      <rect x="0" y={cuerpoTop} width={WALL_W} height={cuerpoBottom - cuerpoTop} className="fill-muted stroke-border" strokeWidth="0.8" />
      <rect x={BUILDING_W - WALL_W} y={cuerpoTop} width={WALL_W} height={cuerpoBottom - cuerpoTop} className="fill-muted stroke-border" strokeWidth="0.8" />

      {/* Ducto del elevador: canal, rieles y carro */}
      <rect
        x={WALL_W + 1}
        y={cuerpoTop}
        width={SHAFT_W - 2}
        height={cuerpoBottom - cuerpoTop}
        rx="3"
        className="fill-muted/60 stroke-border"
        strokeWidth="0.8"
      />
      <line
        x1={WALL_W + SHAFT_W * 0.3} y1={cuerpoTop + 2}
        x2={WALL_W + SHAFT_W * 0.3} y2={cuerpoBottom - 2}
        className="stroke-muted-foreground/35" strokeWidth="1"
      />
      <line
        x1={WALL_W + SHAFT_W * 0.7} y1={cuerpoTop + 2}
        x2={WALL_W + SHAFT_W * 0.7} y2={cuerpoBottom - 2}
        className="stroke-muted-foreground/35" strokeWidth="1"
      />
      <g
        style={{
          transform: `translateY(${subiendo ? yCarroDestino : yCarroAbajo}px)`,
          transition: sinMovimiento ? undefined : `transform ${SUBIDA_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      >
        {/* Cable de suspensión + cabina */}
        <rect x={WALL_W + SHAFT_W / 2 - 0.75} y="0" width="1.5" height="5" className="fill-muted-foreground/70" />
        <rect
          x={WALL_W + SHAFT_W / 2 - 6.5}
          y="5"
          width="13"
          height={CAR_H - 5}
          rx="3"
          className="fill-primary"
        />
        <rect
          x={WALL_W + SHAFT_W / 2 - 0.6}
          y={5 + (CAR_H - 5) * 0.22}
          width="1.2"
          height={(CAR_H - 5) * 0.55}
          className="fill-primary-foreground/80"
        />
      </g>

      {/* Filas: azotea / salto de niveles / losas / planta baja */}
      {layout.map((box, i) => {
        const f = box.fila;

        if (f.tipo === "azotea") {
          return (
            <g key="azotea">
              <rect x="2" y={box.y + ROOF_H * 0.35} width={BUILDING_W - 4} height={ROOF_H * 0.65} rx="2" className="fill-foreground" />
              <rect x="2" y={box.y + ROOF_H * 0.35 - 3} width={BUILDING_W - 4} height="4" rx="1" className="fill-muted-foreground" />
              <rect x={BUILDING_W * 0.42} y={box.y + ROOF_H * 0.05} width={BUILDING_W * 0.16} height={ROOF_H * 0.32} className="fill-primary" />
            </g>
          );
        }

        // Marca de continuidad: dice cuántos niveles quedan fuera de la ventana,
        // para que el corte no se lea como el edificio completo.
        if (f.tipo === "salto") {
          return (
            <g key={`salto-${i}`}>
              <line
                x1={xLosas + 6} y1={box.cy}
                x2={xLosas + wLosas - 6} y2={box.cy}
                className="stroke-border"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <rect
                x={xLosas + wLosas / 2 - 30} y={box.cy - 7}
                width="60" height="14" rx="7"
                className="fill-background stroke-border"
                strokeWidth="0.8"
              />
              <text
                x={xLosas + wLosas / 2} y={box.cy + 3.2}
                textAnchor="middle"
                style={{ fontSize: "8.5px", fontWeight: 600 }}
                className="fill-muted-foreground"
              >
                + {f.count} {f.count === 1 ? "nivel" : "niveles"}
              </text>
            </g>
          );
        }

        if (f.tipo === "planta-baja") {
          return (
            <g key="pb">
              <rect
                x={xLosas} y={box.y} width={wLosas} height={ROW_H} rx="3"
                strokeWidth="1"
                className="fill-foreground stroke-border"
              />
              <text
                x={xLosas + wLosas / 2} y={box.cy + 3.5}
                textAnchor="middle"
                style={{ fontSize: "10.5px", fontWeight: 600 }}
                className="fill-background"
              >
                PLANTA BAJA
              </text>
            </g>
          );
        }

        const esTuNivel = f.n === nivel;
        const vivo = esTuNivel && llego;
        return (
          <g key={`nivel-${f.n}`} className={vivo ? "sozu-losa-viva" : undefined}>
            <rect
              x={xLosas} y={box.y} width={wLosas} height={ROW_H} rx="3"
              strokeWidth="1"
              className={vivo ? "fill-primary stroke-primary" : "fill-muted stroke-border"}
              style={vivo ? { filter: "drop-shadow(0 0 5px hsl(var(--primary) / 0.55))" } : undefined}
            />
            {!vivo && <FacadeWindows x={xLosas} y={box.y} width={wLosas} />}
            <text
              x={xLosas + wLosas / 2} y={box.cy + 3.5}
              textAnchor="middle"
              style={{ fontSize: "10.5px", fontWeight: 600 }}
              className={vivo ? "fill-primary-foreground" : "fill-muted-foreground"}
            >
              NIVEL {f.n}
            </text>
            {vivo && (
              <g>
                <path d={`M ${BUILDING_W + 2} ${box.cy} l 6 -5 l 0 10 Z`} className="fill-primary" />
                <text
                  x={BUILDING_W + 10} y={box.cy + 3.5}
                  style={{ fontSize: "9px", fontWeight: 700 }}
                  className="fill-primary"
                >
                  Tú
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Base / terreno */}
      <rect x="0" y={baseY} width={BUILDING_W} height={BASE_H} rx="2" className="fill-foreground" />
      <rect x="0" y={baseY} width={BUILDING_W} height="1.5" className="fill-muted-foreground" />
    </svg>
  );
};

/** Textura tenue de ventanas para que la losa lea como fachada. */
const FacadeWindows = ({ x, y, width }: { x: number; y: number; width: number }) => {
  const winW = 5;
  const winH = 8;
  const step = 13;
  const top = y + (ROW_H - winH) / 2;
  const cols: number[] = [];
  for (let wx = x + 7; wx + winW < x + width - 7; wx += step) cols.push(wx);
  return (
    <g className="fill-muted-foreground/15">
      {cols.map((wx) => (
        <rect key={wx} x={wx} y={top} width={winW} height={winH} rx="1" />
      ))}
    </g>
  );
};

// ── Rejilla de respaldo (el nivel no tiene plano cargado) ──

/**
 * Orden de las unidades del nivel según la convención `nivel*100 + posición`.
 * Solo se monta cuando el número de propiedad sigue esa convención
 * (`unidadSigueConvencion`): de lo contrario los vecinos serían inventados.
 * Todas las celdas usan la misma serie — etiquetar la resaltada con el depto
 * ('09') entre vecinas '701…708' hacía leer la rejilla como si mezclara niveles.
 */
const UnitGrid = ({ nivel, posicion }: { nivel: number; posicion: number }) => {
  const cols = 4;
  const filas = Math.max(2, Math.ceil(posicion / cols));
  const celdas = Array.from({ length: filas * cols }, (_, i) => i + 1);

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {celdas.map((i) => {
        const resaltado = i === posicion;
        return (
          <div
            key={i}
            className={`aspect-[1.35] rounded flex items-center justify-center text-[10.5px] font-bold tabular-nums border ${
              resaltado
                ? "bg-primary border-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.45)]"
                : "bg-muted border-border text-muted-foreground"
            }`}
          >
            {nivel * 100 + i}
          </div>
        );
      })}
    </div>
  );
};

export default OfferUnitLocation;
