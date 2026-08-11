// Contenido de los documentos del onboarding, en IndexedDB (el navegador, no
// localStorage: los File no serializan y los PDFs revientan la cuota de ~5MB).
// IndexedDB SÍ persiste blobs, así que el archivo sobrevive un F5 sin re-subir.
//
// Los archivos NO salen del cliente hasta que se Envía la solicitud (subida a
// Storage por URL firmada). Por eso reemplazar/quitar/abandonar el wizard nunca
// deja basura huérfana en Storage: solo se sube lo que realmente se manda.
// Se limpia tras un envío exitoso y en el reset del onboarding.

const DB_NAME = "sozu-onboarding-docs";
const STORE = "blobs";
const DB_VERSION = 1;

export interface DocBlob {
  blob: Blob;
  filename: string;
  contentType: string;
}

function idbDisponible(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!idbDisponible()) {
      reject(new Error("IndexedDB no disponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Guarda (o reemplaza) el archivo de un documento por su id. No lanza. */
export async function setDocBlob(id: string, value: DocBlob): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.put(value, id));
  } catch (e) {
    console.warn("[onboarding-idb] set falló:", e);
  }
}

/** Devuelve el archivo de un documento por su id, o undefined. No lanza. */
export async function getDocBlob(id: string): Promise<DocBlob | undefined> {
  try {
    return await withStore<DocBlob | undefined>(
      "readonly",
      (s) => s.get(id) as IDBRequest<DocBlob | undefined>,
    );
  } catch {
    return undefined;
  }
}

/** Borra el archivo de un documento por su id. No lanza. */
export async function removeDocBlob(id: string): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.delete(id));
  } catch (e) {
    console.warn("[onboarding-idb] remove falló:", e);
  }
}

/** Borra todos los archivos retenidos (tras envío exitoso o reset). No lanza. */
export async function clearDocBlobs(): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.clear());
  } catch (e) {
    console.warn("[onboarding-idb] clear falló:", e);
  }
}
