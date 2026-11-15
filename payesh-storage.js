/* Payesh v11.61 - conservative IndexedDB transition layer.
 * Phase 1: independent durable mirror, per-account raw keys, no destructive migration.
 * The legacy synchronous LocalStorage path and GitHub JSON contract stay unchanged.
 */
(function () {
  'use strict';
  var DB_NAME = 'payesh-crm-db', DB_VERSION = 1, STORE = 'legacyKV';
  var dbPromise = null, queue = Promise.resolve(), ready = false, errors = [];
  var originalSet = Storage.prototype.setItem;
  var originalRemove = Storage.prototype.removeItem;
  function eligible(k) {
    return (/^payesh-u-[^:]+::/.test(k) || /^payesh-(?!auth-|sync-|u-)/.test(k));
  }
  function rawKeys() {
    var result = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && eligible(k)) result.push(k);
    }
    return result;
  }
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB unavailable')); return; }
      var req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('Could not open database')); };
      req.onblocked = function () { reject(new Error('Database open blocked by another tab')); };
    });
    return dbPromise;
  }
  function task(kind, key, value) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        var os = tx.objectStore(STORE);
        if (kind === 'delete') os.delete(key);
        else os.put({key:key, value:value, savedAt:Date.now()});
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('Write failed')); };
        tx.onabort = function () { reject(tx.error || new Error('Write aborted')); };
      });
    });
  }
  function schedule(kind, key, value) {
    queue = queue.catch(function (e) { errors.push(String(e)); })
      .then(function () { return task(kind, key, value); });
    queue.catch(function (e) { errors.push(String(e)); });
  }
  function listIdb() {
    return queue.catch(function () {}).then(openDb).then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }
  function download(filename, text) {
    var blob = new Blob([text], {type:'application/json;charset=utf-8'});
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }
  function accountPrefix() {
    return 'payesh-u-' + (window.__payUser || 'guest') + '::';
  }
  // On startup, take a non-destructive snapshot of *all* accounts' existing local data.
  // The mirror never restores old data without explicit confirmation.
  function initialCopy() {
    rawKeys().forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v !== null) schedule('put', k, v);
    });
    return queue.then(function () { ready = true; });
  }
  // This wrapper is installed last, *after* the app's user isolation + sync hooks.
  // It sees actual namespaced keys by inspecting localStorage after each successful write.
  Storage.prototype.setItem = function (k, value) {
    var result = originalSet.apply(this, arguments);
    if (this === localStorage && /^payesh-/.test(String(k))) {
      var actual = /^payesh-u-/.test(String(k)) ? String(k) :
        ((/^payesh-(?!auth-|sync-|u-)/.test(String(k))) ? accountPrefix() + String(k).slice(7) : String(k));
      if (eligible(actual)) {
        var raw = localStorage.getItem(actual);
        // The actual raw namespaced key is not readable through the app's virtual mapping.
        if (raw === null && actual !== String(k)) raw = localStorage.getItem(String(k));
        if (raw !== null) schedule('put', actual, raw);
      }
    }
    return result;
  };
  Storage.prototype.removeItem = function (k) {
    var result = originalRemove.apply(this, arguments);
    if (this === localStorage && /^payesh-/.test(String(k))) {
      var actual = /^payesh-u-/.test(String(k)) ? String(k) :
        ((/^payesh-(?!auth-|sync-|u-)/.test(String(k))) ? accountPrefix() + String(k).slice(7) : String(k));
      if (eligible(actual)) schedule('delete', actual);
    }
    return result;
  };
  window.PayeshStorage = Object.freeze({
    version: '11.61-phase1',
    status: function () {
      return listIdb().then(function (rows) {
        return {ready: ready, indexedDBRecords: rows.length, localRecords: rawKeys().length,
          pendingErrors: errors.slice(-10), mode:'dual-write-safe-mirror',
          note:'LocalStorage remains primary for app and GitHub; IndexedDB is a durable independent copy.'};
      });
    },
    exportBackup: function () {
      return listIdb().then(function (rows) {
        var obj = {app:'payesh-storage', format:1, createdAt:new Date().toISOString(), rows:rows};
        download('payesh-indexeddb-backup-' + Date.now() + '.json', JSON.stringify(obj));
        return rows.length;
      });
    },
    previewRestore: function () {
      return listIdb().then(function (rows) {
        var pre = accountPrefix();
        return rows.filter(function (r) { return r.key.indexOf(pre)===0; })
          .map(function (r) { return {key:r.key, chars:r.value.length, date:r.savedAt}; });
      });
    },
    restoreMissingForCurrentUser: function () {
      // Only fills *missing* legacy keys for the current account. Never overwrites local changes.
      return listIdb().then(function (rows) {
        var pre = accountPrefix(), count=0;
        rows.forEach(function (r) {
          if (r.key.indexOf(pre)!==0) return;
          if (localStorage.getItem(r.key) !== null) return;
          originalSet.call(localStorage, r.key, r.value); count++;
        });
        return {restored: count, reloadRequired: count > 0};
      });
    }
  });
  initialCopy().catch(function (e) { errors.push(String(e)); });
})();
