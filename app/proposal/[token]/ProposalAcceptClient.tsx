'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

interface Props {
  proposalId: string
  token: string
  status: string
  clientName: string | null
}

export default function ProposalAcceptClient({ proposalId: _proposalId, token, status, clientName }: Props) {
  const [name, setName] = useState(clientName ?? '')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<'accepted' | 'rejected' | null>(
    status === 'accepted' ? 'accepted' : status === 'rejected' ? 'rejected' : null
  )

  async function handle(action: 'accepted' | 'rejected') {
    if (action === 'accepted' && !name.trim()) {
      alert('Veuillez entrer votre nom pour confirmer.')
      return
    }
    setLoading(true)
    await fetch(`/api/proposal/${token}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, client_name: name.trim() }),
    })
    setDone(action)
    setLoading(false)
  }

  if (done === 'accepted') {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-green-800 mb-1">Proposition acceptée</h2>
        <p className="text-green-700 text-sm">Merci {name}! Nous communiquerons avec vous sous peu.</p>
      </div>
    )
  }

  if (done === 'rejected') {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-8 text-center">
        <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-red-800 mb-1">Proposition refusée</h2>
        <p className="text-red-700 text-sm">Nous avons bien pris note de votre décision.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Votre réponse</h2>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Votre nom complet <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Prénom Nom"
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <p className="text-xs text-gray-400 mb-5">
        En acceptant, vous confirmez avoir lu et accepté cette proposition. Votre nom servira de signature électronique.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => handle('accepted')}
          disabled={loading}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Accepter la proposition
        </button>
        <button
          onClick={() => handle('rejected')}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          <XCircle className="h-4 w-4" />
          Refuser
        </button>
      </div>
    </div>
  )
}
