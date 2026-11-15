(function (root) {
  "use strict";
  const DB_NAME = "gameverse";
  const STORE_NAME = "workspace";
  const KEY = "library";
  const FALLBACK_KEY = "gameverse-state-v1";

  function nativeInvoke() {
    return root.__TAURI__?.core?.invoke;
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error("IndexedDB is unavailable.")); return; }
      const request = root.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open the local database."));
    });
  }

  async function readDatabase(db) {
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not read the local database."));
    });
  }

  async function writeDatabase(db, state) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(state, KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save your library."));
      transaction.onabort = () => reject(transaction.error || new Error("The library save was canceled."));
    });
  }

  async function load() {
    const invoke = nativeInvoke();
    if (typeof invoke === "function") {
      return { state: await invoke("load_library"), mode: "tauri" };
    }
    try {
      const db = await openDatabase();
      const state = await readDatabase(db);
      return { state, mode: "indexeddb" };
    } catch (error) {
      try {
        const raw = root.localStorage?.getItem(FALLBACK_KEY);
        return { state: raw ? JSON.parse(raw) : null, mode: "localstorage", warning: error.message };
      } catch (fallbackError) {
        throw new Error(`Unable to open local storage: ${fallbackError.message}`);
      }
    }
  }

  async function save(state, mode) {
    if (mode === "tauri") {
      const invoke = nativeInvoke();
      if (typeof invoke !== "function") throw new Error("The GameVerse desktop storage bridge is unavailable.");
      await invoke("save_library", { state });
      return;
    }
    if (mode === "localstorage") {
      try { root.localStorage.setItem(FALLBACK_KEY, JSON.stringify(state)); }
      catch (error) { throw new Error(`Unable to save on this device: ${error.message}`); }
      return;
    }
    const db = await openDatabase();
    await writeDatabase(db, state);
  }

  root.GameVerseStorage = { load, save };
})(typeof window !== "undefined" ? window : globalThis);
