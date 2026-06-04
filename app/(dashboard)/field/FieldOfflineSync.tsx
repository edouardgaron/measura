// app/(dashboard)/field/FieldOfflineSync.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CloudOff, RefreshCw, Loader2 } from 'lucide-react'
import { allClocks, flushClocks, QUEUE_EVENT } from '@/lib/offline/clockQueue'

// Bandeau de synchro des pointages hors-ligne : compte les pointages en file,
// les renvoie au retour du réseau (événement 'online') et au montage.
export default function FieldOfflineSync() {
  const router = useRouter()
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const refreshCount = useCallback(async () => { setPending((await allClocks()).length) }, [])

  const flush = useCallback(async () => {
    setSyncing(true)
    try {
      const r = await flushClocks()
      setPending(r.remaining)
      if (r.sent > 0) router.refresh()
    } finally { setSyncing(false) }
  }, [router])

  useEffect(() => {
    refreshCount()
    flush() // tentative au montage (si réseau dispo)
    const onOnline = () => flush()
    window.addEventListener('online', onOnline)
    window.addEventListener(QUEUE_EVENT, refreshCount)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener(QUEUE_EVENT, refreshCount)
    }
  }, [flush, refreshCount])

  if (pending === 0) return null
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
      <span className="inline-flex items-center gap-2"><CloudOff className="h-4 w-4" />{pending} pointage(s) en attente de synchronisation</span>
      <button onClick={flush} disabled={syncing} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-900/40 dark:text-amber-200">
        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Synchroniser
      </button>
    </div>
  )
}
