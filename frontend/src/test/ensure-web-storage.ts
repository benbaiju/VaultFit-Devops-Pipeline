const storageByKind = new Map<string, Map<string, string>>();

function createStorage(kind: string): Storage {
  if (!storageByKind.has(kind)) {
    storageByKind.set(kind, new Map());
  }
  const store = storageByKind.get(kind)!;

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

function storageWorks(storage: Storage | undefined): storage is Storage {
  return typeof storage?.getItem === "function" && typeof storage?.setItem === "function";
}

/** Node 22+ with a bad `--localstorage-file` exposes a broken global Storage; jsdom won't replace it. */
export function ensureWebStorage(): void {
  if (!storageWorks(globalThis.localStorage)) {
    Object.defineProperty(globalThis, "localStorage", {
      value: createStorage("local"),
      configurable: true,
      writable: true,
    });
  }

  if (!storageWorks(globalThis.sessionStorage)) {
    Object.defineProperty(globalThis, "sessionStorage", {
      value: createStorage("session"),
      configurable: true,
      writable: true,
    });
  }
}

export function resetWebStorage(): void {
  storageByKind.clear();
  ensureWebStorage();
}
