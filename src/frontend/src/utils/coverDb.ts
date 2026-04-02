const DB_NAME = "phwa_covers";
const STORE_NAME = "covers";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCoverIDB(id: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(dataUrl, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadCoverIDB(id: string): Promise<string | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as string | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCoverIDB(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllCoversIDB(): Promise<Record<string, string>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const map: Record<string, string> = {};
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        map[cursor.key as string] = cursor.value as string;
        cursor.continue();
      } else {
        resolve(map);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function clearAllCoversIDB(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Title-keyed covers: used during bulk import so covers survive backend ID assignment races.
// Keys are stored as "title:<normalizedTitle>".

export function normalizeTitleKey(title: string): string {
  return `title:${title.trim().toLowerCase()}`;
}

export async function saveCoverByTitleIDB(
  title: string,
  dataUrl: string,
): Promise<void> {
  return saveCoverIDB(normalizeTitleKey(title), dataUrl);
}

export async function loadCoverByTitleIDB(
  title: string,
): Promise<string | undefined> {
  return loadCoverIDB(normalizeTitleKey(title));
}

export async function deleteCoverByTitleIDB(title: string): Promise<void> {
  return deleteCoverIDB(normalizeTitleKey(title));
}
