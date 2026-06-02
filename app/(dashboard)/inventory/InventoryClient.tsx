// app/(dashboard)/inventory/InventoryClient.tsx
'use client'

import { useState } from 'react'
import {
  Package, Truck, ShoppingCart, Plus, Trash2, Loader2, AlertTriangle, ArrowUp, ArrowDown,
} from 'lucide-react'
import type { InventoryItem, PurchaseOrder, Supplier } from '@/lib/supabase/types'

const INPUT = 'w-full rounded-xl border border-transparent bg-neutral-100 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100'
const CELL = 'rounded-xl border border-transparent bg-neutral-100 px-2 py-1 text-[13px] text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-neutral-100'
const money = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n ?? 0)

type Tab = 'stock' | 'suppliers' | 'orders'

export default function InventoryClient({
  initialItems, initialSuppliers, initialOrders,
}: {
  initialItems: InventoryItem[]
  initialSuppliers: Supplier[]
  initialOrders: PurchaseOrder[]
}) {
  const [tab, setTab] = useState<Tab>('stock')
  const [items, setItems] = useState<InventoryItem[]>(initialItems)
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [orders, setOrders] = useState<PurchaseOrder[]>(initialOrders)

  const lowStock = items.filter((i) => i.quantity_on_hand <= i.reorder_threshold && i.reorder_threshold > 0)

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'stock', label: 'Inventaire', icon: <Package className="h-4 w-4" />, count: items.length },
    { key: 'suppliers', label: 'Fournisseurs', icon: <Truck className="h-4 w-4" />, count: suppliers.length },
    { key: 'orders', label: 'Commandes', icon: <ShoppingCart className="h-4 w-4" />, count: orders.filter((o) => o.status !== 'received' && o.status !== 'cancelled').length },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100"><Package className="h-6 w-6 text-neutral-900 dark:text-neutral-100" /> Matériaux & inventaire</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Stock, fournisseurs, commandes d’achat et alertes de réapprovisionnement.</p>
      </div>

      {lowStock.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span><strong>{lowStock.length} article(s)</strong> sous le seuil de réapprovisionnement : {lowStock.map((i) => i.name).join(', ')}.</span>
        </div>
      )}

      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t.key ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100' : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'}`}>
            {t.icon}{t.label}<span className="ml-1 rounded-full bg-neutral-100 px-1.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'stock' && <StockTab items={items} setItems={setItems} suppliers={suppliers} />}
      {tab === 'suppliers' && <SuppliersTab suppliers={suppliers} setSuppliers={setSuppliers} />}
      {tab === 'orders' && <OrdersTab orders={orders} setOrders={setOrders} suppliers={suppliers} items={items} setItems={setItems} />}
    </div>
  )
}

// ── Inventaire ──
function StockTab({ items, setItems, suppliers }: { items: InventoryItem[]; setItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>; suppliers: Supplier[] }) {
  const [f, setF] = useState({ name: '', sku: '', unit: 'unité', unit_cost: '', quantity_on_hand: '', reorder_threshold: '', supplier_id: '' })
  const [adding, setAdding] = useState(false)

  async function add() {
    if (!f.name.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        name: f.name, sku: f.sku, unit: f.unit, unit_cost: Number(f.unit_cost) || 0,
        quantity_on_hand: Number(f.quantity_on_hand) || 0, reorder_threshold: Number(f.reorder_threshold) || 0,
        supplier_id: f.supplier_id || undefined,
      }) })
      const json = await res.json()
      if (res.ok) { setItems((p) => [...p, json.item]); setF({ name: '', sku: '', unit: 'unité', unit_cost: '', quantity_on_hand: '', reorder_threshold: '', supplier_id: '' }) }
    } finally { setAdding(false) }
  }
  async function move(id: string, type: 'in' | 'out') {
    const qStr = prompt(type === 'in' ? 'Quantité reçue :' : 'Quantité sortie :')
    if (!qStr) return
    const res = await fetch(`/api/inventory/${id}/movement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, quantity: Number(qStr) }) })
    const json = await res.json()
    if (res.ok) setItems((p) => p.map((i) => (i.id === id ? json.item : i)))
  }
  async function remove(id: string) {
    if (!confirm('Retirer cet article ?')) return
    const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' })
    if (res.ok) setItems((p) => p.filter((i) => i.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="grid gap-2 sm:grid-cols-7">
          <input className={`${INPUT} sm:col-span-2`} placeholder="Article" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className={INPUT} placeholder="Unité" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
          <input type="number" className={INPUT} placeholder="Coût $" value={f.unit_cost} onChange={(e) => setF({ ...f, unit_cost: e.target.value })} />
          <input type="number" className={INPUT} placeholder="Qté" value={f.quantity_on_hand} onChange={(e) => setF({ ...f, quantity_on_hand: e.target.value })} />
          <input type="number" className={INPUT} placeholder="Seuil" value={f.reorder_threshold} onChange={(e) => setF({ ...f, reorder_threshold: e.target.value })} />
          <button onClick={add} disabled={adding} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {items.length === 0 ? <Empty text="Aucun article en inventaire." /> : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <tr><th className="p-3">Article</th><th className="p-3">En stock</th><th className="p-3">Seuil</th><th className="p-3">Coût</th><th className="p-3">Fournisseur</th><th className="p-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {items.map((i) => {
                const low = i.quantity_on_hand <= i.reorder_threshold && i.reorder_threshold > 0
                return (
                  <tr key={i.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="p-3 font-medium text-neutral-900 dark:text-neutral-100">{i.name}{i.sku ? <span className="ml-1 text-xs text-neutral-400 dark:text-neutral-500">({i.sku})</span> : ''}</td>
                    <td className="p-3"><span className={low ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-neutral-700 dark:text-neutral-300'}>{i.quantity_on_hand} {i.unit}</span>{low && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />}</td>
                    <td className="p-3 text-neutral-500 dark:text-neutral-400">{i.reorder_threshold}</td>
                    <td className="p-3 text-neutral-700 dark:text-neutral-300">{money(i.unit_cost)}</td>
                    <td className="p-3 text-neutral-500 dark:text-neutral-400">{i.supplier?.name ?? '—'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => move(i.id, 'in')} title="Entrée" className="rounded-xl p-1 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"><ArrowUp className="h-4 w-4" /></button>
                        <button onClick={() => move(i.id, 'out')} title="Sortie" className="rounded-xl p-1 text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/40"><ArrowDown className="h-4 w-4" /></button>
                        <button onClick={() => remove(i.id)} className="rounded-xl p-1 text-neutral-300 hover:text-red-600 dark:text-neutral-600 dark:hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-neutral-400 dark:text-neutral-500">Fournisseur par défaut : sélectionnez-le après création via la commande. {suppliers.length} fournisseur(s) enregistré(s).</p>
    </div>
  )
}

// ── Fournisseurs ──
function SuppliersTab({ suppliers, setSuppliers }: { suppliers: Supplier[]; setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>> }) {
  const [f, setF] = useState({ name: '', contact_name: '', email: '', phone: '' })
  const [adding, setAdding] = useState(false)
  async function add() {
    if (!f.name.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      const json = await res.json()
      if (res.ok) { setSuppliers((p) => [...p, json.supplier]); setF({ name: '', contact_name: '', email: '', phone: '' }) }
    } finally { setAdding(false) }
  }
  async function remove(id: string) {
    if (!confirm('Retirer ce fournisseur ?')) return
    const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    if (res.ok) setSuppliers((p) => p.filter((s) => s.id !== id))
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="grid gap-2 sm:grid-cols-5">
          <input className={INPUT} placeholder="Nom du fournisseur" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className={INPUT} placeholder="Contact" value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} />
          <input className={INPUT} placeholder="Courriel" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <input className={INPUT} placeholder="Téléphone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <button onClick={add} disabled={adding} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
          </button>
        </div>
      </div>
      {suppliers.length === 0 ? <Empty text="Aucun fournisseur." /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-start justify-between">
                <div><p className="font-medium text-neutral-900 dark:text-neutral-100">{s.name}</p><p className="text-xs text-neutral-500 dark:text-neutral-400">{s.contact_name ?? '—'}</p></div>
                <button onClick={() => remove(s.id)} className="text-neutral-300 hover:text-red-600 dark:text-neutral-600 dark:hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
              {s.email && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{s.email}</p>}
              {s.phone && <p className="text-xs text-neutral-500 dark:text-neutral-400">{s.phone}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Commandes ──
interface POLine { description: string; quantity: number; unit: string; unit_cost: number; inventory_item_id?: string }
function OrdersTab({
  orders, setOrders, suppliers, items, setItems,
}: {
  orders: PurchaseOrder[]; setOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>
  suppliers: Supplier[]; items: InventoryItem[]; setItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>
}) {
  const [showNew, setShowNew] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [lines, setLines] = useState<POLine[]>([{ description: '', quantity: 1, unit: 'unité', unit_cost: 0 }])
  const [saving, setSaving] = useState(false)

  const STATUS: Record<string, string> = { draft: 'Brouillon', ordered: 'Commandée', received: 'Reçue', cancelled: 'Annulée' }
  const COLOR: Record<string, string> = { draft: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300', ordered: 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900', received: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400', cancelled: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400' }

  async function create() {
    const valid = lines.filter((l) => l.description.trim())
    if (valid.length === 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/purchase-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supplier_id: supplierId || undefined, items: valid }) })
      const json = await res.json()
      if (res.ok) { setOrders((p) => [json.order, ...p]); setShowNew(false); setSupplierId(''); setLines([{ description: '', quantity: 1, unit: 'unité', unit_cost: 0 }]) }
    } finally { setSaving(false) }
  }
  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/purchase-orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    const json = await res.json()
    if (res.ok) {
      setOrders((p) => p.map((o) => (o.id === id ? json.order : o)))
      if (status === 'received') { // recharge l'inventaire (stock incrémenté)
        const inv = await fetch('/api/inventory').then((r) => r.json()).catch(() => null)
        if (inv?.items) setItems(inv.items)
      }
    }
  }
  async function remove(id: string) {
    if (!confirm('Supprimer cette commande ?')) return
    const res = await fetch(`/api/purchase-orders/${id}`, { method: 'DELETE' })
    if (res.ok) setOrders((p) => p.filter((o) => o.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNew((s) => !s)} className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"><Plus className="h-4 w-4" /> Nouvelle commande</button>
      </div>

      {showNew && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <select className={`${INPUT} mb-3 max-w-xs`} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Fournisseur (optionnel)</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-neutral-500 dark:text-neutral-400"><th className="pb-1 pr-2">Article</th><th className="pb-1 pr-2">Qté</th><th className="pb-1 pr-2">Unité</th><th className="pb-1 pr-2">Coût</th><th></th></tr></thead>
            <tbody>
              {lines.map((l, i) => {
                const upd = (patch: Partial<POLine>) => setLines((arr) => arr.map((x, idx) => idx === i ? { ...x, ...patch } : x))
                return (
                  <tr key={i}>
                    <td className="py-1 pr-2">
                      <input className={CELL} list="inv-items" placeholder="Description" value={l.description} onChange={(e) => {
                        const match = items.find((it) => it.name === e.target.value)
                        upd({ description: e.target.value, inventory_item_id: match?.id, unit: match?.unit ?? l.unit, unit_cost: match?.unit_cost ?? l.unit_cost })
                      }} />
                    </td>
                    <td className="py-1 pr-2"><input type="number" className={`${CELL} w-16`} value={l.quantity} onChange={(e) => upd({ quantity: Number(e.target.value) || 0 })} /></td>
                    <td className="py-1 pr-2"><input className={`${CELL} w-16`} value={l.unit} onChange={(e) => upd({ unit: e.target.value })} /></td>
                    <td className="py-1 pr-2"><input type="number" className={`${CELL} w-20`} value={l.unit_cost} onChange={(e) => upd({ unit_cost: Number(e.target.value) || 0 })} /></td>
                    <td><button onClick={() => setLines((a) => a.filter((_, idx) => idx !== i))} className="text-neutral-300 hover:text-red-600 dark:text-neutral-600 dark:hover:text-red-400"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <datalist id="inv-items">{items.map((i) => <option key={i.id} value={i.name} />)}</datalist>
          <div className="mt-2 flex items-center justify-between">
            <button onClick={() => setLines((a) => [...a, { description: '', quantity: 1, unit: 'unité', unit_cost: 0 }])} className="text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-100">+ Ligne</button>
            <button onClick={create} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer la commande
            </button>
          </div>
        </div>
      )}

      {orders.length === 0 ? <Empty text="Aucune commande." /> : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <ShoppingCart className="h-5 w-5 shrink-0 text-neutral-400 dark:text-neutral-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{o.po_number}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{o.supplier?.name ?? 'Fournisseur ?'} · {(o.items ?? []).length} article(s) · {money(o.total)}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLOR[o.status]}`}>{STATUS[o.status]}</span>
              <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)} className="rounded-xl border border-transparent bg-neutral-100 px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-neutral-100">
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={() => remove(o.id)} className="text-neutral-300 hover:text-red-600 dark:text-neutral-600 dark:hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-neutral-400 dark:text-neutral-500">Marquer une commande « Reçue » incrémente automatiquement le stock des articles liés.</p>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">{text}</div>
}
