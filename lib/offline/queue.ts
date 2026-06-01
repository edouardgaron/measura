// lib/offline/queue.ts
// ============================================================
// File d'attente hors-ligne (IndexedDB) pour rejouer des requêtes POST
// quand le réseau revient. Utilisée par le pointage GPS.
// Côté client uniquement.
// ============================================================

const DB_NAME = 'measura-offline'
const STORE = 'requests'

interface QueuedRequest {
  id?: number
  url: string
  payload: unknown
  createdAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function addToQueue(url: string, payload: unknown): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add({ url, payload, createdAt: Date.now() } as QueuedRequest)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function readAll(): Promise<QueuedRequest[]> {
  const db = await openDb()
  const items = await new Promise<QueuedRequest[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as QueuedRequest[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return items
}

async function remove(id: number): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export interface SendResult {
  ok: boolean
  queued?: boolean
  error?: string
}

/**
 * Envoie un POST JSON ; si le réseau est indisponible, met en file et
 * retourne { queued: true }. Sinon retourne le résultat réseau.
 */
export async function queueOrSend(url: string, payload: unknown): Promise<SendResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    try { await addToQueue(url, payload); return { ok: false, queued: true } } catch { return { ok: false, error: 'File hors-ligne indisponible' } }
  }
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return { ok: false, error: j.error ?? `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch {
    // Échec réseau → mise en file
    try { await addToQueue(url, payload); return { ok: false, queued: true } } catch { return { ok: false, error: 'Réseau indisponible' } }
  }
}

/** Rejoue les requêtes en file. Retourne le nombre rejoué avec succès. */
export async function flushQueue(): Promise<number> {
  if (typeof indexedDB === 'undefined') return 0
  let sent = 0
  let items: QueuedRequest[] = []
  try { items = await readAll() } catch { return 0 }
  for (const item of items) {
    try {
      const res = await fetch(item.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item.payload) })
      if (res.ok && item.id != null) { await remove(item.id); sent++ }
    } catch {
      break // toujours hors-ligne — réessayer plus tard
    }
  }
  return sent
}
