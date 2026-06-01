'use client'

import { useState } from 'react'
import { CreditCard, Loader2 } from 'lucide-react'

const money = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n ?? 0)

export default function PayButton({ token, balance, deposit }: { token: string; balance: number; deposit: number }) {
  const [loading, setLoading] = useState<'balance' | 'deposit' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pay(kind: 'balance' | 'deposit') {
    setLoading(kind)
    setError(null)
    try {
      const res = await fetch(`/api/invoice/${token}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Erreur')
        return
      }
      if (json.url) window.location.href = json.url
    } catch {
      setError('Erreur de connexion')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-2">
      {deposit > 0 && (
        <button
          onClick={() => pay('deposit')}
          disabled={loading !== null}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-600 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
        >
          {loading === 'deposit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          Payer le dépôt ({money(deposit)})
        </button>
      )}
      <button
        onClick={() => pay('balance')}
        disabled={loading !== null}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading === 'balance' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        Payer maintenant ({money(balance)})
      </button>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  )
}
