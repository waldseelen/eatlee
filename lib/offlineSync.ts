import { get, set } from 'idb-keyval';
import { db } from './firebase';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export interface SyncOperation {
  id: string;
  type: 'set' | 'update' | 'delete';
  collection: string;
  docId: string;
  data?: any;
  timestamp: number;
  retries: number;
}

const SYNC_QUEUE_KEY = 'eatlee_sync_queue';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

let isSyncing = false;

export async function addToSyncQueue(op: Omit<SyncOperation, 'id' | 'timestamp' | 'retries'>) {
  const queue = (await get<SyncOperation[]>(SYNC_QUEUE_KEY)) || [];
  
  const newOp: SyncOperation = {
    ...op,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    retries: 0
  };
  
  queue.push(newOp);
  await set(SYNC_QUEUE_KEY, queue);
  
  // Try syncing immediately
  processSyncQueue();
}

export async function processSyncQueue() {
  if (isSyncing) return;
  if (!navigator.onLine) return;
  
  isSyncing = true;
  
  try {
    const queue = (await get<SyncOperation[]>(SYNC_QUEUE_KEY)) || [];
    if (queue.length === 0) return;
    
    const remainingQueue: SyncOperation[] = [];
    
    for (const op of queue) {
      if (!navigator.onLine) {
        remainingQueue.push(op);
        continue;
      }
      
      try {
        const docRef = doc(db, op.collection, op.docId);
        if (op.type === 'set') {
          await setDoc(docRef, op.data, { merge: true });
        } else if (op.type === 'update') {
          await updateDoc(docRef, op.data);
        } else if (op.type === 'delete') {
          await deleteDoc(docRef);
        }
      } catch (error) {
        console.error(`Failed to sync operation ${op.id}:`, error);
        op.retries += 1;
        
        if (op.retries < MAX_RETRIES) {
          remainingQueue.push(op);
          
          // Exponential backoff
          const delay = BASE_DELAY_MS * Math.pow(2, op.retries - 1);
          setTimeout(processSyncQueue, delay);
        } else {
          console.error(`Operation ${op.id} reached max retries. Dropping from queue.`);
        }
      }
    }
    
    await set(SYNC_QUEUE_KEY, remainingQueue);
  } finally {
    isSyncing = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processSyncQueue();
  });
}
