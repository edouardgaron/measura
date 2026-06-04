// app/(dashboard)/field/FieldClockButton.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Square, Loader2 } from 'lucide-react'

export default function FieldClockButton({
  projectId, employeeId, clockedIn,
}: { projectId: string; employeeId: string | null; clockedIn: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [on, setOn] = useState(clockedIn)

  async function getGps(): Promise<{ gps_lat?: number; gps_lng?: number }> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return {}
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ gps_lat: pos.coords.latitude, gps_lng: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 4000 }
      )
    })
  }

  async function toggle() {
    if (!employeeId) { alert('Aucun profil employé lié à votre compte. Demandez à l’administrateur de vous ajouter à l’équipe.'); return }
    setBusy(true)
    try {
      const gps = await getGps()
      const res = await fetch('/api/time-clock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, employee_id: employeeId, action: on ? 'out' : 'in', ...gps }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { alert(j.error ?? 'Erreur de pointage'); return }
      setOn(!on)
      router.refresh()
    } finally { setBusy(false) }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:opacity-50 ${
        on
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'bg-emerald-600 text-white hover:bg-emerald-700'
      }`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : on ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      {on ? 'Pointer la sortie' : 'Pointer l’arrivée'}
    </button>
  )
}
