// Tiny promise wrapper around IndexedDB. No dependency needed.

const DB_NAME = 'our-little-library';
const DB_VERSION = 1;

export type StoreName = 'books' | 'states' | 'prefs' | 'blobs' | 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('states')) {
        const s = db.createObjectStore('states', { keyPath: 'key' });
        s.createIndex('userId', 'userId');
      }
      if (!db.objectStoreNames.contains('prefs')) db.createObjectStore('prefs', { keyPath: 'userId' });
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open the library database.'));
    req.onblocked = () => reject(new Error('The library is open in another tab that needs to be closed first.'));
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: StoreName, mode: IDBTransactionMode) {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

export const idb = {
  async get<T>(name: StoreName, key: IDBValidKey): Promise<T | undefined> {
    return wrap((await store(name, 'readonly')).get(key)) as Promise<T | undefined>;
  },
  async getAll<T>(name: StoreName): Promise<T[]> {
    return wrap((await store(name, 'readonly')).getAll()) as Promise<T[]>;
  },
  async getAllByIndex<T>(name: StoreName, index: string, value: IDBValidKey): Promise<T[]> {
    return wrap((await store(name, 'readonly')).index(index).getAll(value)) as Promise<T[]>;
  },
  async put(name: StoreName, value: unknown, key?: IDBValidKey): Promise<void> {
    await wrap((await store(name, 'readwrite')).put(value, key));
  },
  async delete(name: StoreName, key: IDBValidKey): Promise<void> {
    await wrap((await store(name, 'readwrite')).delete(key));
  },
};

/** Ask the browser not to evict our data under storage pressure (best effort). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      return await navigator.storage.persist();
    }
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}
