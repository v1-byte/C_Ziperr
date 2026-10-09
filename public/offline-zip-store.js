/* C.Ziperr — persistent local ZIP store (device-local, no network) */
(function (global) {
  'use strict';
  const DB_NAME = 'c-ziperr-local-packages';
  const DB_VERSION = 1;
  const STORE = 'packages';
  const MAX_ENTRIES = 12;

  function supported() { return typeof indexedDB !== 'undefined'; }
  function openDb() {
    if (!supported()) return Promise.reject(new Error('IndexedDB tidak tersedia di browser ini.'));
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('savedAt', 'savedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Gagal membuka penyimpanan lokal.'));
    });
  }
  async function transaction(mode, callback) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const result = callback(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error || new Error('Transaksi penyimpanan gagal.'));
        tx.onabort = () => reject(tx.error || new Error('Transaksi penyimpanan dibatalkan.'));
      });
    } finally { db.close(); }
  }
  async function prune(store) {
    return new Promise((resolve, reject) => {
      const request = store.index('savedAt').getAllKeys();
      request.onsuccess = () => {
        const keys = request.result || [];
        keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).forEach((key) => store.delete(key));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
  async function save(blob, name, meta = {}) {
    if (!blob || !blob.size) throw new Error('ZIP kosong.');
    const id = String(meta.id || 'latest');
    await transaction('readwrite', (store) => {
      store.put({ id, name: String(name || 'game-resources.zip'), blob, size: blob.size, savedAt: new Date().toISOString(), source: String(meta.source || 'capture') });
      prune(store).catch(() => {});
    });
    return { id, name: String(name || 'game-resources.zip'), size: blob.size };
  }
  async function get(id = 'latest') {
    return transaction('readonly', (store) => new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    }));
  }
  async function list() {
    return transaction('readonly', (store) => new Promise((resolve, reject) => {
      const request = store.index('savedAt').getAll();
      request.onsuccess = () => resolve((request.result || []).reverse());
      request.onerror = () => reject(request.error);
    }));
  }
  global.GCZipStore = { supported, save, get, list };
})(window);
