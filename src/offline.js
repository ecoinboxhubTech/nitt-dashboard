// Offline queue for desk transactions, replayed through POST /circulation/sync.
const KEY = "nitt-offline-queue";

export const readQueue = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
export const writeQueue = (q) => { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* storage unavailable */ } };
export const queueTx = (tx) => { const q = [...readQueue(), tx]; writeQueue(q); return q; };
export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}-offline`);
