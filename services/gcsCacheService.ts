/**
 * Two-Tier Client-Side GCS Fingerprint + IndexedDB Overflow Cache Service
 *
 * Provides:
 * 1. L1 In-Memory Map Front-Cache (`idbMemoryCache`) over IndexedDB so repeat reads
 *    within a session resolve in < 0.1ms without opening an IDB transaction.
 * 2. Asynchronous IndexedDB persistence (`app_gcs_cache_db`) for large/image-heavy payloads
 *    that exceed the browser's 5MB `localStorage` quota.
 */

export interface IDBCacheEnvelope<T = any> {
  key: string;
  data: T;
  fingerprint?: string | null;
  updatedAt?: string | null;
  md5?: string;
  timestamp: number;
}

const IDB_DB_NAME = 'app_gcs_cache_db';
const IDB_STORE_NAME = 'run_payloads';
const IDB_VERSION = 1;

/**
 * L1 In-Memory front-cache over IndexedDB (< 0.1ms synchronous/microtask reads).
 */
const idbMemoryCache = new Map<string, IDBCacheEnvelope<any>>();

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openCacheDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined' || !indexedDB) {
    return Promise.resolve(null);
  }
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise<IDBDatabase | null>(resolve => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
            db.createObjectStore(IDB_STORE_NAME, { keyPath: 'key' });
          }
        } catch {
          // Ignore schema upgrade errors in restricted contexts
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });
  return dbPromise;
}

/**
 * Synchronous read from the L1 in-memory front-cache over IndexedDB (< 0.1ms).
 */
export function getIDBCacheSync<T = any>(key: string): IDBCacheEnvelope<T> | null {
  return (idbMemoryCache.get(key) as IDBCacheEnvelope<T> | undefined) ?? null;
}

/**
 * Reads an entry from the L1 in-memory Map first (< 0.1ms, zero IDB transaction overhead).
 * On L1 miss, opens a read-only IndexedDB transaction and populates the L1 Map for subsequent reads.
 */
export async function getIDBCache<T = any>(key: string): Promise<IDBCacheEnvelope<T> | null> {
  const memHit = idbMemoryCache.get(key);
  if (memHit !== undefined) {
    return memHit as IDBCacheEnvelope<T>;
  }

  const db = await openCacheDatabase();
  if (!db) return null;

  return new Promise<IDBCacheEnvelope<T> | null>(resolve => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const result = req.result as IDBCacheEnvelope<T> | undefined;
        if (result && typeof result === 'object' && 'data' in result) {
          idbMemoryCache.set(key, result);
          resolve(result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function isInvalidCacheData(val: any): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'object' && !Array.isArray(val)) {
    if (
      val.status === 'empty' ||
      val.notModified === true ||
      val.status === 'not_modified' ||
      val.unchanged === true ||
      ('data' in val && val.data === null) ||
      Object.keys(val).length === 0
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Updates the L1 in-memory Map immediately and persists the payload asynchronously in IndexedDB.
 * Never persists empty, null, or notModified stub payloads.
 */
export async function setIDBCache<T = any>(
  key: string,
  data: T,
  meta?: {
    fingerprint?: string | null;
    updatedAt?: string | null;
    md5?: string;
    timestamp?: number;
  }
): Promise<IDBCacheEnvelope<T>> {
  const envelope: IDBCacheEnvelope<T> = {
    key,
    data,
    fingerprint: meta?.fingerprint ?? null,
    updatedAt: meta?.updatedAt ?? null,
    md5: meta?.md5,
    timestamp: meta?.timestamp ?? Date.now()
  };

  if (isInvalidCacheData(data)) {
    return envelope;
  }

  // 1. Update L1 memory cache synchronously (< 0.1ms)
  idbMemoryCache.set(key, envelope);

  // 2. Persist to IndexedDB asynchronously
  const db = await openCacheDatabase();
  if (!db) return envelope;

  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.put(envelope);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });

  return envelope;
}

/**
 * Deletes a specific key or all keys matching a prefix (or clears all if neither provided)
 * from both the L1 in-memory Map and IndexedDB.
 */
export async function deleteIDBCache(key?: string, prefix?: string): Promise<void> {
  if (key) {
    idbMemoryCache.delete(key);
  } else if (prefix) {
    for (const k of Array.from(idbMemoryCache.keys())) {
      if (k.startsWith(prefix)) {
        idbMemoryCache.delete(k);
      }
    }
  } else {
    idbMemoryCache.clear();
  }

  const db = await openCacheDatabase();
  if (!db) return;

  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      if (key) {
        store.delete(key);
      } else if (prefix) {
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
      } else {
        store.clear();
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

