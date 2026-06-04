'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2, Check } from 'lucide-react'

interface QuoteOption {
  id: string; tier: string; name: string | null; description: string | null
  features: string[]; total: number; is_recommended: boolean
}

interface Props {
  proposalId: string
  token: string
  status: string
  clientName: string | null
  options?: QuoteOption[]
  selectedOptionId?: string | null
}

const CAD = (n: number) => (n || 0).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })

export default function ProposalAcceptClient({ proposalId: _proposalId, token, status, clientName, options = [], selectedOptionId = null }: Props) {
  const [name, setName] = useState(clientName ?? '')
  const [loading, setLoading] = useState(false)
  const [chosen, setChosen] = useState<string | null>(
    selectedOptionId ?? options.find((o) => o.is_recommended)?.id ?? (options[0]?.id ?? null)
  )
  const [done, setDone] = useState<'accepted' | 'rejected' | null>(
    status === 'accepted' ? 'accepted' : status === 'rejected' ? 'rejected' : null
  )

  const hasOptions = options.length > 0

  async function handle(action: 'accepted' | 'rejected') {
    if (action === 'accepted' && !name.trim()) {
      alert('Veuillez entrer votre nom pour confirmer.')
      return
    }
    if (action === 'accepted' && hasOptions && !chosen) {
      alert('Veuillez choisir une option avant d’accepter.')
      return
    }
    setLoading(true)
    await fetch(`/api/proposal/${token}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, client_name: name.trim(), selected_option_id: action === 'accepted' ? chosen : null }),
    })
    setDone(action)
    setLoading(false)
  }

  if (done === 'accepted') {
    const opt = options.find((o) => o.id === chosen)
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-green-800 mb-1">Proposition acceptée</h2>
        <p className="text-green-700 text-sm">
          Merci {name}!{opt ? ` Vous avez choisi l’option « ${opt.name ?? opt.tier} » (${CAD(opt.total)}).` : ''} Nous communiquerons avec vous sous peu.
        </p>
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
    <div className="space-y-5">
      {/* Choix des options */}
      {hasOptions && (
        <div className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Choisissez votre option</h2>
          <p className="text-xs text-gray-400 mb-4">Sélectionnez le forfait qui vous convient.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {options.map((o) => {
              const sel = chosen === o.id
              return (
                <button
                  key={o.id}
                  onClick={() => setChosen(o.id)}
                  className={`relative text-left rounded-2xl border p-4 transition-all ${sel ? 'border-blue-600 ring-2 ring-blue-200 bg-blue-50/40' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  {o.is_recommended && <span className="absolute -top-2.5 left-4 rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-semibold text-white">RECOMMANDÉ</span>}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{o.name ?? o.tier}</span>
                    {sel && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                  </div>
                  <p className="mt-1 text-xl font-bold text-gray-900">{o.total > 0 ? CAD(o.total) : '—'}</p>
                  <ul className="mt-2 space-y-1">
                    {o.features.map((ft, i) => (
                      <li key={i} className="flex items-start gap-1 text-xs text-gray-600"><Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />{ft}</li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Réponse + signature */}
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
          En acceptant, vous confirmez avoir lu et accepté cette proposition{hasOptions ? ' et l’option choisie' : ''}. Votre nom servira de signature électronique.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => handle('accepted')}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Accepter{hasOptions ? ' cette option' : ' la proposition'}
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
    </div>
  )
}
