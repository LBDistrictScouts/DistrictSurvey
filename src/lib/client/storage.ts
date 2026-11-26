// Browser storage that never throws: private browsing and blocked storage behave as empty storage.

export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const memory = new Map<string, string>();

/** An in-memory store used when the browser refuses access to storage. */
export const memoryStore: KeyValueStore = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => void memory.set(key, value),
  removeItem: (key) => void memory.delete(key),
};

function guarded(get: () => Storage): KeyValueStore {
  return {
    getItem: (key) => {
      try {
        return get().getItem(key);
      } catch {
        return memoryStore.getItem(key);
      }
    },
    setItem: (key, value) => {
      try {
        get().setItem(key, value);
      } catch {
        memoryStore.setItem(key, value);
      }
    },
    removeItem: (key) => {
      try {
        get().removeItem(key);
      } catch {
        memoryStore.removeItem(key);
      }
      memoryStore.removeItem(key);
    },
  };
}

export const local = guarded(() => window.localStorage);
export const session = guarded(() => window.sessionStorage);

export function readJson<T>(store: KeyValueStore, key: string): T | undefined {
  const text = store.getItem(key);
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    store.removeItem(key);
    return undefined;
  }
}

export function writeJson(store: KeyValueStore, key: string, value: unknown): void {
  store.setItem(key, JSON.stringify(value));
}
