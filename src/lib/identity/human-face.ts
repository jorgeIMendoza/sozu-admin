/**
 * Comparación facial local (sin servicio externo) con `@vladmandic/human`.
 *
 * Reemplaza la verificación por servicio de visión (`verificar-documento-identidad`),
 * que dependía de un gateway externo. Todo corre en el dispositivo: la selfie no sale
 * del navegador.
 *
 * Tres detalles que definen si esto funciona o no con una INE:
 *  1. El retrato impreso ocupa pocos píxeles → se escala la imagen y además se recorta
 *     el rostro y se vuelve a leer en alta resolución (dos pasadas).
 *  2. La INE trae el retrato Y el "fantasma" traslúcido → se detectan varios rostros y
 *     se usa el de mayor área.
 *  3. `filter.equalization` deforma la comparación impreso-vs-cámara → apagado.
 *
 * Modelos: CDN público de `human-models`. Para producción conviene auto-hospedarlos
 * (copiar `models/` a `public/human-models/` y apuntar `MODEL_BASE_PATH` ahí).
 */

const MODEL_BASE_PATH = "https://vladmandic.github.io/human-models/models/";

/**
 * Modelos de embedding disponibles.
 *
 * `faceres` es el descriptor genérico de Human (pensado para edad/género); rinde mal
 * comparando un retrato impreso contra una cámara. `mobilefacenet` es un módulo aparte
 * de Human (MobileFaceNet entrenado con ArcFace) que SOBRESCRIBE el descriptor con uno
 * de reconocimiento facial real: es el adecuado para documento-vs-selfie.
 *
 * Cada modelo tiene su propia escala de coseno, por eso el umbral es por modelo.
 */
export const EMBEDDING_MODELS = {
  mobilefacenet: {
    label: "MobileFaceNet",
    umbral: 0.45,
    config: {
      description: { enabled: false },
      mobilefacenet: { enabled: true, modelPath: "mobilefacenet.json" },
    } as Record<string, any>,
  },
  faceres: {
    label: "FaceRes",
    umbral: 0.6,
    config: {
      description: { enabled: true, modelPath: "faceres.json" },
      mobilefacenet: { enabled: false },
    } as Record<string, any>,
  },
  "faceres-deep": {
    label: "FaceRes deep",
    umbral: 0.6,
    config: {
      description: { enabled: true, modelPath: "faceres-deep.json" },
      mobilefacenet: { enabled: false },
    } as Record<string, any>,
  },
} as const;

export type EmbeddingModel = keyof typeof EMBEDDING_MODELS;

/** Modelo usado por el flujo oficial (el de prueba deja elegir). */
export const DEFAULT_EMBEDDING_MODEL: EmbeddingModel = "mobilefacenet";

/** Umbral por defecto; el real sale de `EMBEDDING_MODELS[modelo].umbral`. */
export const FACE_MATCH_THRESHOLD = 0.45;
/** Umbral de anti-spoof (foto de una foto / pantalla). */
export const ANTISPOOF_THRESHOLD = 0.5;
/** Ancho del lienzo de trabajo del documento (espacio de coordenadas de los rostros). */
const BASE_WIDTH = 1600;
/** Ancho al que se reescala cada mosaico antes de detectar. */
const TILE_WIDTH = 640;
/** Ancho objetivo del rostro recortado para sacar el embedding. */
const TARGET_FACE_WIDTH = 320;

export interface FaceReading {
  embedding: number[];
  /** Confianza de la detección del rostro (0-1). */
  score: number;
  /** Anti-spoof: 1 = rostro real, 0 = probable foto de foto o pantalla. */
  real: number;
  /** Liveness: señales de rostro vivo (solo aplica a la selfie en vivo). */
  live: number;
  /** Tamaño del rostro detectado en px (ancho x alto). */
  boxSize: [number, number];
  /** Cuántos rostros encontró en la imagen (una INE suele traer el fantasma). */
  facesDetected: number;
  /** true si hizo falta recortar y reescalar el rostro para poder leerlo. */
  recortado: boolean;
}

export interface FaceMatchResult {
  /** Mejor similitud obtenida entre las muestras de cámara. */
  similitud: number;
  /** Similitudes de todas las muestras, para ver dispersión. */
  muestras: number[];
  /** Distancia euclidiana cruda de la mejor muestra (menor = más parecido). */
  distancia: number;
  coincide: boolean;
  modelo: EmbeddingModel;
  documento: FaceReading;
  selfie: FaceReading;
  duracionMs: number;
}

/** Resultado de `verificarRostro`: éxito con datos o fallo con motivo legible. */
export type VerificacionRostro =
  | { ok: true; data: FaceMatchResult; motivo?: undefined }
  | { ok: false; motivo: string; data?: undefined };

type HumanInstance = any;

const instancias = new Map<EmbeddingModel, Promise<HumanInstance>>();
/** Cache de lecturas del documento: no hace falta recalcular en cada intento. */
const cacheDocumento = new Map<string, FaceReading | null>();

/** Carga perezosa por modelo: el bundle de Human/TFJS no debe entrar al chunk inicial. */
export async function getHuman(modelo: EmbeddingModel = DEFAULT_EMBEDDING_MODEL): Promise<HumanInstance> {
  const cacheada = instancias.get(modelo);
  if (cacheada) return cacheada;

  const promesa = (async () => {
    const { Human } = await import("@vladmandic/human");
    const human = new Human({
      modelBasePath: MODEL_BASE_PATH,
      cacheSensitivity: 0,
      debug: false,
      // El pipeline de filtros de Human reescribe el frame antes de detectar y en
      // algunos backends degrada (o vacía) la imagen: se detecta sobre el original.
      filter: { enabled: false },
      face: {
        enabled: true,
        detector: { rotation: true, maxDetected: 5, minConfidence: 0.15, return: false },
        mesh: { enabled: true },
        iris: { enabled: false },
        emotion: { enabled: false },
        antispoof: { enabled: true },
        liveness: { enabled: true },
        ...EMBEDDING_MODELS[modelo].config,
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
      segmentation: { enabled: false },
    });
    await human.load();
    await human.warmup();
    return human;
  })().catch((err) => {
    instancias.delete(modelo);
    throw err;
  });

  instancias.set(modelo, promesa);
  return promesa;
}

/**
 * Config explícita para cada `detect()`.
 *
 * OJO: Human **fusiona y conserva** el config que se le pasa a `detect()`. Si una
 * llamada apaga `description`, las siguientes siguen sin calcular embedding aunque no
 * lo pidan. Por eso cada llamada declara SIEMPRE todos los módulos que necesita.
 */
function cfgDeteccion(
  modelo: EmbeddingModel,
  conEmbedding: boolean,
  detector: Record<string, any> = {}
) {
  const cfgModelo = EMBEDDING_MODELS[modelo].config;
  const embedding = conEmbedding
    ? cfgModelo
    : { description: { enabled: false }, mobilefacenet: { enabled: false } };
  return {
    face: {
      enabled: true,
      mesh: { enabled: true },
      antispoof: { enabled: conEmbedding },
      liveness: { enabled: conEmbedding },
      detector: { rotation: true, maxDetected: 5, minConfidence: 0.15, ...detector },
      ...embedding,
    },
  };
}

function toReading(face: any, total: number, recortado = false): FaceReading | null {
  const embedding: number[] | undefined = face?.embedding;
  if (!embedding || embedding.length === 0) return null;
  const box = face.box || [0, 0, 0, 0];
  return {
    embedding,
    score: face.faceScore ?? face.score ?? 0,
    real: typeof face.real === "number" ? face.real : 1,
    live: typeof face.live === "number" ? face.live : 1,
    boxSize: [Math.round(box[2] || 0), Math.round(box[3] || 0)],
    facesDetected: total,
    recortado,
  };
}

/** De todos los rostros detectados se queda con el de mayor área. */
function rostroPrincipal(faces: any[]): any | null {
  if (!faces?.length) return null;
  return faces.reduce((mejor, f) => {
    const area = (f.box?.[2] || 0) * (f.box?.[3] || 0);
    const mejorArea = (mejor.box?.[2] || 0) * (mejor.box?.[3] || 0);
    return area > mejorArea ? f : mejor;
  });
}

function dibujarEnCanvas(
  fuente: CanvasImageSource,
  sx: number, sy: number, sw: number, sh: number,
  dw: number, dh: number,
  filtroCss?: string
): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(dw));
  canvas.height = Math.max(1, Math.round(dh));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (filtroCss) ctx.filter = filtroCss;
  ctx.drawImage(fuente, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Lee el rostro de un elemento ya renderizado (imagen, video o canvas). */
export async function leerRostro(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  modelo: EmbeddingModel = DEFAULT_EMBEDDING_MODEL
): Promise<FaceReading | null> {
  const human = await getHuman(modelo);
  const result = await human.detect(input, cfgDeteccion(modelo, true));
  const faces = result?.face ?? [];
  const face = rostroPrincipal(faces);
  return face ? toReading(face, faces.length) : null;
}

/** Detección ligera (sin embedding) para retroalimentar al usuario en vivo. */
export async function detectarRostroRapido(
  video: HTMLVideoElement,
  modelo: EmbeddingModel = DEFAULT_EMBEDDING_MODEL
): Promise<{ score: number; anchoRostro: number } | null> {
  const human = await getHuman(modelo);
  const result = await human.detect(video, cfgDeteccion(modelo, false));
  const face = rostroPrincipal(result?.face ?? []);
  if (!face) return null;
  return {
    score: face.faceScore ?? face.score ?? 0,
    anchoRostro: Math.round(face.box?.[2] || 0),
  };
}

/** Diagnóstico paso a paso de la búsqueda del rostro en el documento. */
export interface DiagnosticoDocumento {
  pasos: string[];
  lectura: FaceReading | null;
}

const cacheDiagnostico = new Map<string, DiagnosticoDocumento>();

/** Carga la imagen sin riesgo de contaminar el canvas: fetch + bitmap. */
async function cargarBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar la identificación`);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

/**
 * Busca el rostro en la foto de una identificación y devuelve el detalle de lo que
 * intentó, para poder diagnosticar cuando falla.
 *
 * El detector (BlazeFace) redimensiona TODA la imagen a ~128-256 px: el retrato de una
 * INE ocupa ~8% del ancho, o sea unos 10 px a esa escala, y no se detecta por más que
 * se escale la imagen completa. Por eso se busca por regiones: mosaicos solapados,
 * cada uno reescalado, hasta que el rostro ocupe una fracción grande del cuadro.
 */
export async function analizarDocumento(
  url: string,
  modelo: EmbeddingModel = DEFAULT_EMBEDDING_MODEL
): Promise<DiagnosticoDocumento> {
  const claveCache = `${modelo}|${url}`;
  const cacheado = cacheDiagnostico.get(claveCache);
  if (cacheado) return cacheado;

  const pasos: string[] = [];
  const registrar = (linea: string) => {
    pasos.push(linea);
    console.info("[human-face]", linea);
  };

  const human = await getHuman(modelo);

  let bitmap: ImageBitmap;
  try {
    bitmap = await cargarBitmap(url);
    registrar(`imagen descargada ${bitmap.width}x${bitmap.height}`);
  } catch (err: any) {
    registrar(`no se pudo descargar la imagen: ${err?.message || err}`);
    const salida = { pasos, lectura: null };
    cacheDiagnostico.set(claveCache, salida);
    return salida;
  }

  const escalaBase = Math.min(BASE_WIDTH / bitmap.width, 2);
  const base = dibujarEnCanvas(bitmap, 0, 0, bitmap.width, bitmap.height, bitmap.width * escalaBase, bitmap.height * escalaBase);
  if (!base) {
    registrar("no se pudo preparar el lienzo de trabajo");
    const salida = { pasos, lectura: null };
    cacheDiagnostico.set(claveCache, salida);
    return salida;
  }
  registrar(`lienzo base ${base.width}x${base.height}`);

  // Verificación de píxeles: si el canvas estuviera contaminado, el detector fallaría
  // con un error opaco. Mejor detectarlo aquí.
  try {
    base.getContext("2d")!.getImageData(0, 0, 1, 1);
  } catch {
    registrar("canvas contaminado (CORS): la imagen no permite lectura de píxeles");
    const salida = { pasos, lectura: null };
    cacheDiagnostico.set(claveCache, salida);
    return salida;
  }

  type Caja = { x: number; y: number; w: number; h: number; score: number };
  const candidatos: Caja[] = [];

  const detectarEn = async (
    sx: number, sy: number, sw: number, sh: number,
    override: Record<string, any>,
    filtroCss?: string
  ): Promise<number> => {
    const escala = TILE_WIDTH / sw;
    const tile = dibujarEnCanvas(base, sx, sy, sw, sh, sw * escala, sh * escala, filtroCss);
    if (!tile) return 0;
    // Solo interesan las cajas: sin embedding ni anti-spoof va mucho más rápido.
    const res = await human.detect(tile, cfgDeteccion(modelo, false, override.detector ?? {}));
    let encontrados = 0;
    for (const f of res?.face ?? []) {
      const [bx, by, bw, bh] = f.box || [0, 0, 0, 0];
      if (bw <= 0 || bh <= 0) continue;
      encontrados++;
      candidatos.push({
        x: sx + bx / escala,
        y: sy + by / escala,
        w: bw / escala,
        h: bh / escala,
        score: f.faceScore ?? f.score ?? 0,
      });
    }
    return encontrados;
  };

  const barrerMosaicos = async (divisiones: number, override: Record<string, any>, filtroCss?: string) => {
    const solape = 0.25;
    const anchoTile = base.width / divisiones;
    const altoTile = base.height / divisiones;
    let total = 0;
    for (let fila = 0; fila < divisiones; fila++) {
      for (let col = 0; col < divisiones; col++) {
        const sx = Math.max(0, col * anchoTile - anchoTile * solape);
        const sy = Math.max(0, fila * altoTile - altoTile * solape);
        const sw = Math.min(base.width - sx, anchoTile * (1 + solape * 2));
        const sh = Math.min(base.height - sy, altoTile * (1 + solape * 2));
        total += await detectarEn(sx, sy, sw, sh, override, filtroCss);
      }
    }
    return total;
  };

  // Estrategias en orden de costo. Se corta en cuanto una encuentra algo.
  const estrategias: { nombre: string; ejecutar: () => Promise<number> }[] = [
    {
      nombre: "imagen completa",
      ejecutar: () => detectarEn(0, 0, base.width, base.height, {}),
    },
    { nombre: "mosaicos 2x2", ejecutar: () => barrerMosaicos(2, {}) },
    { nombre: "mosaicos 3x3", ejecutar: () => barrerMosaicos(3, {}) },
    {
      nombre: "mosaicos 3x3 sin rotación y umbral bajo",
      ejecutar: () => barrerMosaicos(3, { detector: { rotation: false, minConfidence: 0.05, maxDetected: 10 } }),
    },
    {
      nombre: "mosaicos 4x4 umbral bajo",
      ejecutar: () => barrerMosaicos(4, { detector: { rotation: false, minConfidence: 0.05, maxDetected: 10 } }),
    },
    {
      // El retrato de una INE está impreso en tinta gris de bajo contraste; realzarlo
      // suele ser la diferencia entre detectar y no detectar.
      nombre: "mosaicos 3x3 con contraste realzado",
      ejecutar: () => barrerMosaicos(
        3,
        { detector: { rotation: false, minConfidence: 0.05, maxDetected: 10 } },
        "grayscale(1) contrast(1.6) brightness(1.15)"
      ),
    },
    {
      nombre: "imagen completa con contraste realzado",
      ejecutar: () => detectarEn(
        0, 0, base.width, base.height,
        { detector: { rotation: false, minConfidence: 0.05, maxDetected: 10 } },
        "grayscale(1) contrast(1.6) brightness(1.15)"
      ),
    },
  ];

  for (const estrategia of estrategias) {
    const encontrados = await estrategia.ejecutar();
    registrar(`${estrategia.nombre}: ${encontrados} rostro(s)`);
    if (candidatos.length > 0) break;
  }

  if (candidatos.length === 0) {
    const salida = { pasos, lectura: null };
    cacheDiagnostico.set(claveCache, salida);
    return salida;
  }

  // El retrato principal es el rostro más grande (el "fantasma" de la INE es menor).
  const principal = candidatos.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b));
  registrar(`retrato elegido ${Math.round(principal.w)}x${Math.round(principal.h)} px (score ${principal.score.toFixed(2)})`);

  // Recorte con margen, reescalado, para obtener el embedding.
  const margen = 0.5;
  const sx = Math.max(0, principal.x - principal.w * margen);
  const sy = Math.max(0, principal.y - principal.h * margen);
  const sw = Math.min(base.width - sx, principal.w * (1 + margen * 2));
  const sh = Math.min(base.height - sy, principal.h * (1 + margen * 2));
  const escalaRostro = Math.max(1, TARGET_FACE_WIDTH / principal.w);
  const recorte = dibujarEnCanvas(base, sx, sy, sw, sh, sw * escalaRostro, sh * escalaRostro);

  let lectura: FaceReading | null = null;
  if (recorte) {
    const intentos: { nombre: string; canvas: HTMLCanvasElement }[] = [
      { nombre: "recorte", canvas: recorte },
    ];
    const recorteRealzado = dibujarEnCanvas(
      base, sx, sy, sw, sh, sw * escalaRostro, sh * escalaRostro,
      "grayscale(1) contrast(1.5) brightness(1.1)"
    );
    if (recorteRealzado) intentos.push({ nombre: "recorte realzado", canvas: recorteRealzado });

    for (const intento of intentos) {
      const res = await human.detect(intento.canvas, cfgDeteccion(modelo, true, { rotation: false, minConfidence: 0.05 }));
      const face = rostroPrincipal(res?.face ?? []);
      const candidata = face ? toReading(face, candidatos.length, true) : null;
      if (candidata) {
        candidata.boxSize = [Math.round(principal.w), Math.round(principal.h)];
        lectura = candidata;
        registrar(`embedding del documento listo (${intento.nombre}, ${candidata.embedding.length} dims)`);
        break;
      }
      registrar(
        face
          ? `${intento.nombre}: rostro detectado pero el modelo no devolvió embedding`
          : `${intento.nombre}: no se detectó rostro en el recorte`
      );
    }
  }

  const salida = { pasos, lectura };
  cacheDiagnostico.set(claveCache, salida);
  cacheDocumento.set(claveCache, lectura);
  return salida;
}

/** Atajo: solo la lectura del rostro del documento. */
export async function leerRostroDesdeUrl(
  url: string,
  modelo: EmbeddingModel = DEFAULT_EMBEDDING_MODEL
): Promise<FaceReading | null> {
  const claveCache = `${modelo}|${url}`;
  if (cacheDocumento.has(claveCache)) return cacheDocumento.get(claveCache)!;
  const { lectura } = await analizarDocumento(url, modelo);
  return lectura;
}

/** Invalida el cache del documento (tras subir una identificación nueva). */
export function limpiarCacheDocumento(url?: string) {
  if (!url) {
    cacheDocumento.clear();
    cacheDiagnostico.clear();
    return;
  }
  for (const clave of [...cacheDocumento.keys()]) {
    if (clave.endsWith(`|${url}`)) cacheDocumento.delete(clave);
  }
  for (const clave of [...cacheDiagnostico.keys()]) {
    if (clave.endsWith(`|${url}`)) cacheDiagnostico.delete(clave);
  }
}

/**
 * Similitud coseno entre descriptores (-1 a 1; en la práctica 0 a 1).
 *
 * Se usa el coseno y no `human.match.similarity`, que normaliza con una escala
 * calibrada para FaceRes y no aplica a MobileFaceNet. El coseno es comparable entre
 * modelos y es la métrica estándar de ArcFace.
 */
export function similitudCoseno(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Coseno + la similitud normalizada de Human, como referencia cruzada. */
export async function compararDescriptores(
  a: number[],
  b: number[],
  modelo: EmbeddingModel = DEFAULT_EMBEDDING_MODEL
): Promise<{ similitud: number; distancia: number }> {
  const human = await getHuman(modelo);
  return {
    similitud: similitudCoseno(a, b),
    distancia: human.match.similarity(a, b),
  };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Compara la identificación contra varias muestras de la cámara y se queda con la
 * mejor. Un solo frame puede salir movido, con parpadeo o mala luz: promediar en el
 * tiempo es lo que hace que esto sea usable.
 */
export async function verificarRostro(
  docUrl: string,
  video: HTMLVideoElement,
  opciones?: { modelo?: EmbeddingModel; threshold?: number; muestras?: number; intervaloMs?: number }
): Promise<VerificacionRostro> {
  const modelo = opciones?.modelo ?? DEFAULT_EMBEDDING_MODEL;
  const threshold = opciones?.threshold ?? EMBEDDING_MODELS[modelo].umbral;
  const totalMuestras = opciones?.muestras ?? 5;
  const intervaloMs = opciones?.intervaloMs ?? 220;
  const inicio = performance.now();

  let documento: FaceReading | null = null;
  try {
    documento = await leerRostroDesdeUrl(docUrl, modelo);
  } catch {
    return { ok: false, motivo: "No se pudo cargar la imagen de la identificación." };
  }
  if (!documento) {
    return {
      ok: false,
      motivo: "No se detecta un rostro en tu identificación. Vuelve a capturarla de cerca, enfocada y sin reflejos.",
    };
  }

  const similitudes: number[] = [];
  let mejor: { similitud: number; distancia: number; selfie: FaceReading } | null = null;

  for (let i = 0; i < totalMuestras; i++) {
    const selfie = await leerRostro(video, modelo);
    if (selfie) {
      const { similitud, distancia } = await compararDescriptores(documento.embedding, selfie.embedding, modelo);
      similitudes.push(similitud);
      if (!mejor || similitud > mejor.similitud) mejor = { similitud, distancia, selfie };
    }
    if (i < totalMuestras - 1) await esperar(intervaloMs);
  }

  if (!mejor) {
    return { ok: false, motivo: "No se detectó tu rostro. Acércate a la cámara y busca buena luz." };
  }

  return {
    ok: true,
    data: {
      similitud: mejor.similitud,
      muestras: similitudes,
      distancia: mejor.distancia,
      coincide: mejor.similitud >= threshold,
      modelo,
      documento,
      selfie: mejor.selfie,
      duracionMs: Math.round(performance.now() - inicio),
    },
  };
}
