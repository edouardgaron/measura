// app/(dashboard)/inventory/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { InventoryItem, PurchaseOrder, Supplier } from '@/lib/supabase/types'
import InventoryClient from './InventoryClient'

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [itemsRes, suppliersRes, ordersRes] = await Promise.all([
    supabase.from('inventory_items').select('*, supplier:suppliers(id, name)').eq('is_active', true).order('name', { ascending: true }),
    supabase.from('suppliers').select('*').eq('is_active', true).order('name', { ascending: true }),
    supabase.from('purchase_orders').select('*, supplier:suppliers(id, name), items:purchase_order_items(id, inventory_item_id, description, quantity, unit, unit_cost, total)').order('created_at', { ascending: false }),
  ])

  return (
    <InventoryClient
      initialItems={(itemsRes.data as InventoryItem[]) ?? []}
      initialSuppliers={(suppliersRes.data as Supplier[]) ?? []}
      initialOrders={(ordersRes.data as PurchaseOrder[]) ?? []}
    />
  )
}
