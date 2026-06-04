// lib/offline/clockQueue.ts
// ============================================================
// File de pointages hors-ligne (IndexedDB). Sur un chantier sans réseau,
// le pointage est mis en file localement puis synchronisé au retour du
// réseau. Client only.
// ============================================================

export interface QueuedClock {
  id: string
  project_id: string
  employee_id: string
  action: 'in' | 'out'
  gps_lat?: number
  gps_lng?: number
  ts: number
}

const DB_NAME = 'cp-field'
const STORE = 'clockQueue'
export const QUEUE_EVENT = 'cp-clock-queue-changed'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const r = fn(t.objectStore(STORE))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  }))
}

export async function enqueueClock(item: Omit<QueuedClock, 'id' | 'ts'>): Promise<void> {
  const full: QueuedClock = { ...item, id: `${item.project_id}-${Date.now()}-${Math.round(performance.now())}`, ts: Date.now() }
  await tx('readwrite', (s) => s.add(full))
  window.dispatchEvent(new Event(QUEUE_EVENT))
}

export async function allClocks(): Promise<QueuedClock[]> {
  try { return (await tx<QueuedClock[]>('readonly', (s) => s.getAll())) ?? [] } catch { return [] }
}

export async function removeClock(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
  window.dispatchEvent(new Event(QUEUE_EVENT))
}

/** Tente d'envoyer tous les pointages en file. Retourne {sent, remaining}. */
export async function flushClocks(): Promise<{ sent: number; remaining: number }> {
  const items = await allClocks()
  let sent = 0
  for (const it of items) {
    try {
      const res = await fetch('/api/time-clock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: it.project_id, employee_id: it.employee_id, action: it.action, gps_lat: it.gps_lat, gps_lng: it.gps_lng }),
      })
      if (res.ok) { await removeClock(it.id); sent++ }
      else if (res.status >= 400 && res.status < 500) { await removeClock(it.id) } // requête invalide → on abandonne
      // 5xx/réseau : on laisse en file
    } catch { /* hors-ligne : on garde */ }
  }
  const remaining = (await allClocks()).length
  return { sent, remaining }
}
