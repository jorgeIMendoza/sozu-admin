/**
 * Comparación facial local (sin servicio externo) con `@vladmandic/human`.
 *
 * PRUEBA / BETA: sirve para medir si el reconocimiento facial en el navegador es más
 * confiable que la verificación por servicio de visión. Todo corre en el dispositivo:
 * la selfie no sale del navegador.
 *
 * Modelos: por defecto se cargan del CDN público de `human-models`. Para producción
 * conviene auto-hospedarlos (copiar `models/` a `public/human-models/` y apuntar
 * `MODEL_BASE_PATH` a `/human-models/`) y no depender de un tercero.
 */

const MODEL_BASE_PATH = "https://vladmandic.github.io/human-models/models/";

/** Modelos de embedding disponibles. Distinta precisión y escala de similitud. */
export const EMBEDDING_MODELS = {
  faceres: { label: "FaceRes (default)", modelPath: "faceres.json" },
  "faceres-deep": { label: "FaceRes deep", modelPath: "faceres-deep.json" },
  mobilefacenet: { label: "MobileFaceNet", modelPath: "mobilefacenet.json" },
} as const;

export type EmbeddingModel = keyof typeof EMBEDDING_MODELS;

/** Umbral inicial de similitud (0-1). Se calibra con casos reales antes de exigirlo. */
export const FACE_MATCH_THRESHOLD = 0.55;
/** Umbral de anti-spoof (foto de una foto / pantalla). */
export const ANTISPOOF_THRESHOLD = 0.5;
/** Ancho mínimo al que se escala la foto del documento antes de detectar. */
const MIN_DOC_WIDTH = 1400;

export interface FaceReading {
  embedding: number[];
  /** Confianza de la detección del rostro (0-1). */
  score: number;
  /** Anti-spoof: 1 = rostro real, 0 = probable foto de foto o pantalla. */
  real: number;
  /** Liveness: señales de rostro vivo (solo aplica a la selfie en vivo). */
  live: number;
  /** Tamaño del rostro detectado en px (ancho x alto), para diagnosticar fotos chicas. */
  boxSize: [number, number];
  /** Cuántos rostros encontró en la imagen (una INE suele traer el fantasma). */
  facesDetected: number;
}

export interface FaceMatchResult {
  similitud: number;
  /** Distancia euclidiana cruda entre descriptores (menor = más parecido). */
  distancia: number;
  coincide: boolean;
  modelo: EmbeddingModel;
  documento: FaceReading;
  selfie: FaceReading;
  duracionMs: number;
}

type HumanInstance = any;

const instancias = new Map<EmbeddingModel, Promise<HumanInstance>>();

/** Carga perezosa por modelo: el bundle de Human/TFJS no debe entrar al chunk inicial. */
export async function getHuman(modelo: EmbeddingModel = "faceres"): Promise<HumanInstance> {
  const cacheada = instancias.get(modelo);
  if (cacheada) return cacheada;

  const promesa = (async () => {
    const { Human } = await import("@vladmandic/human");
    const human = new Human({
      modelBasePath: MODEL_BASE_PATH,
      cacheSensitivity: 0,
      debug: false,
      // La ecualización altera el histograma y degrada la comparación de fotos
      // impresas (INE) contra cámara: se deja apagada.
      filter: { enabled: true, equalization: false },
      face: {
        enabled: true,
        // maxDetected > 1: la INE trae el rostro impreso y el "fantasma"; luego se
        // elige el más grande, que es el bueno.
        detector: { rotation: true, maxDetected: 5, minConfidence: 0.15, return: false },
        mesh: { enabled: true },
        iris: { enabled: false },
        description: { enabled: true, modelPath: EMBEDDING_MODELS[modelo].modelPath },
        emotion: { enabled: false },
        antispoof: { enabled: true },
        liveness: { enabled: true },
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

function toReading(face: any, total: number): FaceReading | null {
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

/** Lee el rostro de un elemento ya renderizado (imagen, video o canvas). */
export async function leerRostro(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  modelo: EmbeddingModel = "faceres"
): Promise<FaceReading | null> {
  const human = await getHuman(modelo);
  const result = await human.detect(input);
  const faces = result?.face ?? [];
  const face = rostroPrincipal(faces);
  return face ? toReading(face, faces.length) : null;
}

/**
 * Carga una imagen remota respetando CORS (Supabase Storage responde `*`), la escala
 * si viene chica —el rostro impreso de una INE ocupa pocos píxeles— y lee el rostro.
 */
export async function leerRostroDesdeUrl(
  url: string,
  modelo: EmbeddingModel = "faceres"
): Promise<FaceReading | null> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();

  if (img.naturalWidth >= MIN_DOC_WIDTH) return leerRostro(img, modelo);

  const escala = MIN_DOC_WIDTH / img.naturalWidth;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * escala);
  canvas.height = Math.round(img.naturalHeight * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) return leerRostro(img, modelo);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return leerRostro(canvas, modelo);
}

/** Similitud normalizada (0-1) y distancia cruda entre dos descriptores. */
export async function compararDescriptores(
  a: number[],
  b: number[],
  modelo: EmbeddingModel = "faceres"
): Promise<{ similitud: number; distancia: number }> {
  const human = await getHuman(modelo);
  return {
    similitud: human.match.similarity(a, b),
    distancia: human.match.distance(a, b),
  };
}

/** Compara la foto del documento contra un frame de la cámara. */
export async function verificarRostro(
  docUrl: string,
  selfieSource: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  opciones?: { modelo?: EmbeddingModel; threshold?: number }
): Promise<{ ok: true; data: FaceMatchResult } | { ok: false; motivo: string }> {
  const modelo = opciones?.modelo ?? "faceres";
  const threshold = opciones?.threshold ?? FACE_MATCH_THRESHOLD;
  const inicio = performance.now();

  let documento: FaceReading | null = null;
  try {
    documento = await leerRostroDesdeUrl(docUrl, modelo);
  } catch {
    return { ok: false, motivo: "No se pudo cargar la imagen de la identificación." };
  }
  if (!documento) {
    return { ok: false, motivo: "No se detectó un rostro en la identificación registrada." };
  }

  const selfie = await leerRostro(selfieSource, modelo);
  if (!selfie) {
    return { ok: false, motivo: "No se detectó tu rostro. Acércate y busca buena luz." };
  }

  const { similitud, distancia } = await compararDescriptores(documento.embedding, selfie.embedding, modelo);

  return {
    ok: true,
    data: {
      similitud,
      distancia,
      coincide: similitud >= threshold,
      modelo,
      documento,
      selfie,
      duracionMs: Math.round(performance.now() - inicio),
    },
  };
}
