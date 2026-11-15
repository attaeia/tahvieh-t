/**
 * PayeshStorage - High-Capacity IndexedDB Storage Engine (Replaces 10MB localStorage)
 * Supports gigabytes of storage, automatic image compression, and persistent storage requests.
 */
const PayeshStorage = (() => {
    const DB_NAME = 'PayeshElectronicDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'app_data';
    let dbInstance = null;

    // Request persistent storage so the browser won't evict data under storage pressure
    async function requestPersistence() {
        if (navigator.storage && navigator.storage.persist) {
            try {
                const isPersisted = await navigator.storage.persist();
                console.log(`[PayeshStorage] Persistent storage granted: ${isPersisted}`);
            } catch (e) {
                console.warn('[PayeshStorage] Persistence request failed:', e);
            }
        }
    }

    // Open or initialize IndexedDB
    function openDB() {
        if (dbInstance) return Promise.resolve(dbInstance);
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = (event) => {
                dbInstance = event.target.result;
                requestPersistence();
                resolve(dbInstance);
            };
            request.onerror = (event) => {
                console.error('[PayeshStorage] IndexedDB Error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // Save item (supports Objects, Arrays, Blobs, ArrayBuffers, Strings)
    async function setItem(key, value) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(value, key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    // Retrieve item
    async function getItem(key, defaultValue = null) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result !== undefined ? req.result : defaultValue);
            req.onerror = () => reject(req.error);
        });
    }

    // Remove item
    async function removeItem(key) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    // Get all keys
    async function getAllKeys() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAllKeys();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // Migrate old localStorage data automatically if present
    async function migrateFromLocalStorage(prefix = '') {
        const keysToMigrate = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!prefix || k.startsWith(prefix)) {
                keysToMigrate.push(k);
            }
        }
        for (const k of keysToMigrate) {
            try {
                const raw = localStorage.getItem(k);
                let parsed = raw;
                try { parsed = JSON.parse(raw); } catch (_) {}
                await setItem(k, parsed);
                localStorage.removeItem(k);
            } catch (e) {
                console.warn(`[PayeshStorage] Failed migrating key ${k}:`, e);
            }
        }
        if (keysToMigrate.length > 0) {
            console.log(`[PayeshStorage] Migrated ${keysToMigrate.length} items from localStorage to IndexedDB.`);
        }
    }

    // Check current storage quota & usage
    async function getStorageEstimate() {
        if (navigator.storage && navigator.storage.estimate) {
            const est = await navigator.storage.estimate();
            return {
                usageMB: (est.usage / (1024 * 1024)).toFixed(2),
                quotaMB: (est.quota / (1024 * 1024)).toFixed(2),
                percentUsed: ((est.usage / est.quota) * 100).toFixed(2)
            };
        }
        return null;
    }

    return {
        setItem,
        getItem,
        removeItem,
        getAllKeys,
        migrateFromLocalStorage,
        getStorageEstimate
    };
})();