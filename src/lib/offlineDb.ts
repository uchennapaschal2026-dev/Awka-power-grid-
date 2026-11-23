import { DisputePetition, OutageReport, PaygTokenTransaction, TelemetryLogEntry } from '../types/awka';

const DB_NAME = 'awka_power_hub_v1';
const DB_VERSION = 1;

interface PersistedState {
  telemetryLogs?: Record<string, TelemetryLogEntry[]>;
  outageReports?: OutageReport[];
  petitions?: DisputePetition[];
  transactions?: PaygTokenTransaction[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv_store')) {
        db.createObjectStore('kv_store');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function loadPersistedState(): Promise<PersistedState | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction('kv_store', 'readonly');
      const store = tx.objectStore('kv_store');
      const req = store.get('app_state');
      req.onsuccess = () => resolve((req.result as PersistedState) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function savePersistedState(state: PersistedState): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction('kv_store', 'readwrite');
      const store = tx.objectStore('kv_store');
      store.put(state, 'app_state');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Graceful no-op in restricted browsing contexts
  }
}

export async function clearPersistedState(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction('kv_store', 'readwrite');
      tx.objectStore('kv_store').delete('app_state');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Graceful no-op
  }
}
