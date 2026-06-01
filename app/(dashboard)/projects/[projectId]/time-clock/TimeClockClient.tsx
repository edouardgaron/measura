// app/(dashboard)/projects/[projectId]/time-clock/TimeClockClient.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, MapPin, LogIn, LogOut, Loader2, Wifi, WifiOff } from 'lucide-react'
import { queueOrSend, flushQueue } from '@/lib/offline/queue'

interface Emp { id: string; full_name: string }
interface Entry {
  id: string; employee_id: string | null; employee_name: string | null
  clock_in: string | null; clock_out: string | null; hours: number; gps_lat: number | null; gps_lng: number | null
}

export default function TimeClockClient({ projectId, employees }: { projectId: string; employees: Emp[] }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '')
  const [entries, setEntries] = useState<Entry[]>([])
  const [busy, setBusy] = useState<'in' | 'out' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [online, setOnline] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/time-clock?project_id=${projectId}`, { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) setEntries(json.entries ?? [])
    } catch { /* hors-ligne */ }
  }, [projectId])

  useEffect(() => {
    setOnline(navigator.onLine)
    const on = () => { setOnline(true); flushQueue().then(load) }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    flushQueue().finally(load)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [load])

  function getPosition(): Promise<{ lat: number | null; lng: number | null }> {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve({ lat: null, lng: null })
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { enableHighAccuracy: true, timeout: 8000 }
      )
    })
  }

  async function punch(action: 'in' | 'out') {
    if (!employeeId) return
    setBusy(action); setMsg(null)
    try {
      const pos = await getPosition()
      const payload = { project_id: projectId, employee_id: employeeId, action, gps_lat: pos.lat, gps_lng: pos.lng }
      const result = await queueOrSend('/api/time-clock', payload)
      if (result.queued) {
        setMsg('Hors ligne — pointage enregistré, sera synchronisé au retour du réseau.')
      } else if (!result.ok) {
        setMsg(result.error ?? 'Erreur')
      } else {
        setMsg(action === 'in' ? '✓ Arrivée enregistrée' : '✓ Départ enregistré')
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  const emp = employees.find((e) => e.id === employeeId)

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><Clock className="h-5 w-5 text-teal-600" /> Pointage</h2>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${online ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />} {online ? 'En ligne' : 'Hors ligne'}
        </span>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-xs font-medium text-gray-500">Employé</label>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm">
          {employees.length === 0 && <option value="">Aucun employé</option>}
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => punch('in')} disabled={busy !== null || !employeeId} className="flex flex-col items-center gap-1 rounded-xl bg-emerald-600 px-4 py-5 text-white hover:bg-emerald-700 disabled:opacity-60">
            {busy === 'in' ? <Loader2 className="h-6 w-6 animate-spin" /> : <LogIn className="h-6 w-6" />}
            <span className="text-sm font-medium">Arrivée</span>
          </button>
          <button onClick={() => punch('out')} disabled={busy !== null || !employeeId} className="flex flex-col items-center gap-1 rounded-xl bg-gray-800 px-4 py-5 text-white hover:bg-gray-900 disabled:opacity-60">
            {busy === 'out' ? <Loader2 className="h-6 w-6 animate-spin" /> : <LogOut className="h-6 w-6" />}
            <span className="text-sm font-medium">Départ</span>
          </button>
        </div>
        {msg && <p className={`mt-3 text-center text-sm ${msg.startsWith('✓') ? 'text-emerald-600' : 'text-amber-600'}`}>{msg}</p>}
        <p className="mt-2 flex items-center justify-center gap-1 text-xs text-gray-400"><MapPin className="h-3 w-3" /> Position GPS capturée automatiquement {emp ? `pour ${emp.full_name}` : ''}</p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Aujourd&apos;hui</h3>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun pointage.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <span className="font-medium text-gray-900">{e.employee_name ?? '—'}</span>
                <span className="text-gray-500">{e.clock_in?.slice(0, 5) ?? '—'} → {e.clock_out?.slice(0, 5) ?? '…'}</span>
                <span className="ml-auto text-gray-700">{e.hours ? `${e.hours} h` : ''}</span>
                {e.gps_lat != null && <MapPin className="h-3.5 w-3.5 text-teal-500" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
