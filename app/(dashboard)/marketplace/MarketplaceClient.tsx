// app/(dashboard)/marketplace/MarketplaceClient.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Store, Plus, Trash2, Loader2, Search, Send, MessageSquare, Megaphone } from 'lucide-react'
import type { MarketplaceListing, Rfq, RfqResponse } from '@/lib/supabase/types'

const INPUT = 'w-full rounded-xl border border-transparent bg-neutral-100 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100'
const money = (n: number | null) => (n == null ? '—' : new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n))
type Tab = 'directory' | 'open' | 'mine'

export default function MarketplaceClient() {
  const [tab, setTab] = useState<Tab>('directory')
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'directory', label: 'Annuaire', icon: <Store className="h-4 w-4" /> },
    { key: 'open', label: 'Demandes ouvertes', icon: <Megaphone className="h-4 w-4" /> },
    { key: 'mine', label: 'Mes demandes', icon: <MessageSquare className="h-4 w-4" /> },
  ]
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100"><Store className="h-6 w-6 text-neutral-900 dark:text-neutral-100" /> Marketplace fournisseurs</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Annuaire de produits, demandes de prix (RFQ) et réponses entre entreprises.</p>
      </div>
      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t.key ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100' : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {tab === 'directory' && <Directory />}
      {tab === 'open' && <OpenRfqs />}
      {tab === 'mine' && <MyRfqs />}
    </div>
  )
}

// ── Annuaire ──
function Directory() {
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [f, setF] = useState({ title: '', category: '', unit: 'unité', price: '', region: '', contact_email: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/marketplace/listings${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      const json = await res.json()
      if (res.ok) setListings(json.listings ?? [])
    } finally { setLoading(false) }
  }, [q])
  useEffect(() => { load() }, [load])

  async function create() {
    if (!f.title.trim()) return
    const res = await fetch('/api/marketplace/listings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, price: f.price ? Number(f.price) : undefined }) })
    if (res.ok) { setShowNew(false); setF({ title: '', category: '', unit: 'unité', price: '', region: '', contact_email: '' }); load() }
  }
  async function remove(id: string) {
    if (!confirm('Retirer cette annonce ?')) return
    const res = await fetch(`/api/marketplace/listings/${id}`, { method: 'DELETE' })
    if (res.ok) setListings((p) => p.filter((l) => l.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400 dark:text-neutral-500" />
          <input className={`${INPUT} pl-9`} placeholder="Rechercher un produit…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button onClick={() => setShowNew((s) => !s)} className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"><Plus className="h-4 w-4" /> Publier</button>
      </div>

      {showNew && (
        <div className="grid gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:grid-cols-3">
          <input className={INPUT} placeholder="Titre du produit" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <input className={INPUT} placeholder="Catégorie" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          <input className={INPUT} placeholder="Région" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
          <input type="number" className={INPUT} placeholder="Prix $" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          <input className={INPUT} placeholder="Unité" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
          <input className={INPUT} placeholder="Courriel contact" value={f.contact_email} onChange={(e) => setF({ ...f, contact_email: e.target.value })} />
          <div className="sm:col-span-3 flex justify-end"><button onClick={create} className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200">Publier l’annonce</button></div>
        </div>
      )}

      {loading ? <Loading /> : listings.length === 0 ? <Empty text="Aucune annonce." /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <div key={l.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-start justify-between">
                <div><p className="font-medium text-neutral-900 dark:text-neutral-100">{l.title}</p><p className="text-xs text-neutral-500 dark:text-neutral-400">{l.category ?? '—'}{l.region ? ` · ${l.region}` : ''}</p></div>
                <button onClick={() => remove(l.id)} className="text-neutral-300 hover:text-red-600 dark:text-neutral-600 dark:hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
              <p className="mt-2 text-lg font-bold text-neutral-900 dark:text-neutral-100">{money(l.price)}<span className="text-xs font-normal text-neutral-400 dark:text-neutral-500"> /{l.unit}</span></p>
              {l.contact_email && <a href={`mailto:${l.contact_email}`} className="mt-1 block text-xs text-neutral-500 hover:underline dark:text-neutral-400">{l.contact_email}</a>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Demandes ouvertes (répondre) ──
function OpenRfqs() {
  const [rfqs, setRfqs] = useState<Rfq[]>([])
  const [loading, setLoading] = useState(true)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [reply, setReply] = useState({ supplier_name: '', price: '', lead_time_days: '', message: '', contact_email: '' })

  useEffect(() => {
    fetch('/api/marketplace/rfqs?scope=open').then((r) => r.json()).then((j) => setRfqs(j.rfqs ?? [])).finally(() => setLoading(false))
  }, [])

  async function send(rfqId: string) {
    const res = await fetch(`/api/marketplace/rfqs/${rfqId}/responses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...reply, price: reply.price ? Number(reply.price) : undefined, lead_time_days: reply.lead_time_days ? Number(reply.lead_time_days) : undefined }),
    })
    if (res.ok) { setReplyTo(null); setReply({ supplier_name: '', price: '', lead_time_days: '', message: '', contact_email: '' }); alert('Réponse envoyée !') }
  }

  if (loading) return <Loading />
  if (rfqs.length === 0) return <Empty text="Aucune demande ouverte pour le moment." />
  return (
    <div className="space-y-2">
      {rfqs.map((r) => (
        <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-neutral-900 dark:text-neutral-100">{r.title}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{r.category ?? '—'}{r.region ? ` · ${r.region}` : ''}{r.needed_by ? ` · requis le ${r.needed_by}` : ''}</p>
              {r.description && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{r.description}</p>}
            </div>
            <button onClick={() => setReplyTo(replyTo === r.id ? null : r.id)} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"><Send className="h-3.5 w-3.5" /> Répondre</button>
          </div>
          {replyTo === r.id && (
            <div className="mt-3 grid gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800 sm:grid-cols-2">
              <input className={INPUT} placeholder="Votre entreprise" value={reply.supplier_name} onChange={(e) => setReply({ ...reply, supplier_name: e.target.value })} />
              <input type="number" className={INPUT} placeholder="Prix offert $" value={reply.price} onChange={(e) => setReply({ ...reply, price: e.target.value })} />
              <input type="number" className={INPUT} placeholder="Délai (jours)" value={reply.lead_time_days} onChange={(e) => setReply({ ...reply, lead_time_days: e.target.value })} />
              <input className={INPUT} placeholder="Courriel" value={reply.contact_email} onChange={(e) => setReply({ ...reply, contact_email: e.target.value })} />
              <textarea className={`${INPUT} sm:col-span-2`} rows={2} placeholder="Message" value={reply.message} onChange={(e) => setReply({ ...reply, message: e.target.value })} />
              <div className="sm:col-span-2 flex justify-end"><button onClick={() => send(r.id)} className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200">Envoyer l’offre</button></div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Mes demandes ──
function MyRfqs() {
  const [rfqs, setRfqs] = useState<Rfq[]>([])
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState({ title: '', description: '', category: '', region: '', needed_by: '' })

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/marketplace/rfqs?scope=mine').then((r) => r.json()).then((j) => setRfqs(j.rfqs ?? [])).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  async function create() {
    if (!f.title.trim()) return
    const res = await fetch('/api/marketplace/rfqs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    if (res.ok) { setF({ title: '', description: '', category: '', region: '', needed_by: '' }); load() }
  }
  async function close(id: string) {
    const res = await fetch(`/api/marketplace/rfqs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'closed' }) })
    if (res.ok) load()
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:grid-cols-3">
        <input className={INPUT} placeholder="Titre (ex. Bardeaux IKO 30 paquets)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input className={INPUT} placeholder="Catégorie" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <input className={INPUT} placeholder="Région" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
        <input type="date" className={INPUT} value={f.needed_by} onChange={(e) => setF({ ...f, needed_by: e.target.value })} />
        <input className={`${INPUT} sm:col-span-2`} placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <div className="sm:col-span-3 flex justify-end"><button onClick={create} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"><Plus className="h-4 w-4" /> Publier une demande</button></div>
      </div>

      {loading ? <Loading /> : rfqs.length === 0 ? <Empty text="Aucune demande publiée." /> : (
        <div className="space-y-2">
          {rfqs.map((r) => (
            <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-neutral-900 dark:text-neutral-100">{r.title}</p><p className="text-xs text-neutral-500 dark:text-neutral-400">Statut : {r.status} · {(r.responses ?? []).length} réponse(s)</p></div>
                {r.status === 'open' && <button onClick={() => close(r.id)} className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700">Clôturer</button>}
              </div>
              {(r.responses ?? []).length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  {(r.responses as RfqResponse[]).map((resp) => (
                    <div key={resp.id} className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-800/50">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">{resp.supplier_name ?? 'Fournisseur'}</span>
                      <span className="text-neutral-900 dark:text-neutral-100">{money(resp.price)}</span>
                      {resp.lead_time_days != null && <span className="text-xs text-neutral-500 dark:text-neutral-400">· {resp.lead_time_days} j</span>}
                      {resp.message && <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">· {resp.message}</span>}
                      {resp.contact_email && <a href={`mailto:${resp.contact_email}`} className="ml-auto text-xs text-neutral-500 hover:underline dark:text-neutral-400">Contacter</a>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Loading() { return <div className="flex h-32 items-center justify-center text-neutral-400 dark:text-neutral-500"><Loader2 className="h-6 w-6 animate-spin" /></div> }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">{text}</div> }
