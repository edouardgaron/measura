// app/(dashboard)/field/FieldPhotoButton.tsx
'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Capture rapide d'une photo de chantier depuis le terrain → bucket `photos`
// + ligne dans `photos` (visible au bureau dans l'onglet Photos du projet).
export default function FieldPhotoButton({ projectId }: { projectId: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [count, setCount] = useState(0)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${projectId}/field-${Date.now()}.${ext}`
      const { error: up } = await supabase.storage.from('photos').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
      if (up) throw new Error(up.message)
      const { error: ins } = await supabase.from('photos').insert({
        project_id: projectId, uploaded_by: user?.id ?? null, storage_path: path,
        original_name: file.name, mime_type: file.type || 'image/jpeg', photo_category: 'other',
      })
      if (ins) throw new Error(ins.message)
      setCount((c) => c + 1)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : count > 0 ? <Check className="h-4 w-4 text-emerald-500" /> : <Camera className="h-4 w-4" />}
        {count > 0 ? `${count} photo${count > 1 ? 's' : ''}` : 'Photo'}
      </button>
    </>
  )
}
