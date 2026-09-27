import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  query,
  limit,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with IndexedDB Multi-Tab Persistent Cache to minimize network reads to near zero
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  }, firebaseConfig.firestoreDatabaseId || '(default)');
} catch {
  // If already initialized or unsupported in current environment, fallback safely to existing instance
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
}

export const db = firestoreInstance;

export { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, writeBatch, query, limit };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// Quota limit detection
export function isQuotaExceededError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Free daily read units') ||
    msg.includes('free tier database')
  );
}

// Global Quota Listener for UI Alerting
type QuotaListener = (isExceeded: boolean, errorMsg: string) => void;
const quotaListeners = new Set<QuotaListener>();

export function subscribeQuotaExceeded(listener: QuotaListener): () => void {
  quotaListeners.add(listener);
  return () => {
    quotaListeners.delete(listener);
  };
}

export function notifyQuotaExceeded(errorMsg: string) {
  quotaListeners.forEach((listener) => listener(true, errorMsg));
}

// Local storage backup functions to keep the app functional when offline or during quota limits
export function getOfflineCollection<T>(collectionName: string, fallback: T[] = []): T[] {
  try {
    const raw = localStorage.getItem(`mbs_offline_${collectionName}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn(`Failed to read offline cache for ${collectionName}:`, e);
  }
  return fallback;
}

export function saveOfflineCollection<T>(collectionName: string, items: T[]) {
  try {
    localStorage.setItem(`mbs_offline_${collectionName}`, JSON.stringify(items));
  } catch {
    // LocalStorage quota may be exceeded if items are very large, ignore safely
  }
}

export function updateOfflineItem<T extends { id: string }>(collectionName: string, item: T) {
  const current = getOfflineCollection<T>(collectionName);
  const idx = current.findIndex((i) => i.id === item.id);
  let next: T[];
  if (idx >= 0) {
    next = [...current];
    next[idx] = { ...next[idx], ...item };
  } else {
    next = [item, ...current];
  }
  saveOfflineCollection(collectionName, next);
}

export function deleteOfflineItem(collectionName: string, id: string) {
  const current = getOfflineCollection<{ id: string }>(collectionName);
  const next = current.filter((i) => i.id !== id);
  saveOfflineCollection(collectionName, next);
}

// Helper function to sync a collection with real-time updates across all devices with offline persistence
export function subscribeCollection<T extends { id: string }>(
  collectionName: string,
  onData: (items: T[]) => void,
  maxLimit?: number
) {
  const colRef = collection(db, collectionName);
  const q = maxLimit ? query(colRef, limit(maxLimit)) : colRef;

  // Immediately initialize with offline data if present so UI never flickers or loads empty
  const cached = getOfflineCollection<T>(collectionName);
  if (cached && cached.length > 0) {
    onData(cached);
  }

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items: T[] = [];
      const seenIds = new Set<string>();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const dataId = (data as any)?.id;
        const itemId = docId || dataId;
        if (itemId && !seenIds.has(itemId) && (!dataId || !seenIds.has(dataId))) {
          seenIds.add(itemId);
          seenIds.add(docId);
          if (dataId) seenIds.add(dataId);
          items.push({ ...data, id: itemId } as T);
        }
      });
      saveOfflineCollection(collectionName, items);
      onData(items);
    },
    (error) => {
      const isQuota = isQuotaExceededError(error);
      if (isQuota) {
        notifyQuotaExceeded(error instanceof Error ? error.message : String(error));
        // Keep using offline cached items, NEVER wipe with empty array!
        const fallback = getOfflineCollection<T>(collectionName);
        if (fallback.length > 0) {
          onData(fallback);
        }
        return;
      }
      handleFirestoreError(error, OperationType.GET, collectionName);
    }
  );

  return unsubscribe;
}

// Helper to sanitize data for Firestore (replaces undefined with null or omits keys)
function sanitizeData(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => (item === undefined ? null : sanitizeData(item)));
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeData(value);
    }
  }
  return clean;
}

// Save or update an item in a Firestore collection
export async function saveToFirestore<T extends { id: string }>(
  collectionName: string,
  item: T,
  options?: { merge?: boolean }
): Promise<boolean> {
  if (item && item.id) {
    updateOfflineItem(collectionName, item);
  }
  try {
    if (!item || !item.id) {
      console.warn(`[Firestore] Attempted to save item without valid id in ${collectionName}`);
      return false;
    }
    const docRef = doc(db, collectionName, item.id);
    const cleanItem = sanitizeData(item);
    if (options?.merge) {
      await setDoc(docRef, cleanItem, { merge: true });
    } else {
      await setDoc(docRef, cleanItem);
    }
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      notifyQuotaExceeded(error instanceof Error ? error.message : String(error));
      return true; // Successfully saved in local offline storage
    }
    handleFirestoreError(error, OperationType.WRITE, `${collectionName}/${item?.id}`);
    return false;
  }
}

// Delete an item from a Firestore collection
export async function deleteFromFirestore(collectionName: string, id: string) {
  deleteOfflineItem(collectionName, id);
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      notifyQuotaExceeded(error instanceof Error ? error.message : String(error));
      return;
    }
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

// Batch save multiple items (e.g. attendance records)
export async function saveBatchToFirestore<T extends { id: string }>(
  collectionName: string,
  items: T[]
) {
  if (!items || items.length === 0) return;
  items.forEach((item) => {
    if (item && item.id) {
      updateOfflineItem(collectionName, item);
    }
  });
  try {
    const chunkSize = 400;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((item) => {
        if (!item?.id) return;
        const docRef = doc(db, collectionName, item.id);
        const cleanItem = sanitizeData(item);
        batch.set(docRef, cleanItem, { merge: true });
      });
      await batch.commit();
    }
  } catch (error) {
    if (isQuotaExceededError(error)) {
      notifyQuotaExceeded(error instanceof Error ? error.message : String(error));
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, collectionName);
  }
}

