// app/(dashboard)/automations/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSmsConfigured } from '@/lib/messaging/sms'
import { isEmailConfigured } from '@/lib/messaging/email'
import type { AutomationRule, MessageTemplate } from '@/lib/supabase/types'
import AutomationClient from './AutomationClient'

export default async function AutomationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [templatesRes, rulesRes] = await Promise.all([
    supabase.from('message_templates').select('*').order('created_at', { ascending: false }),
    supabase.from('automation_rules').select('*, template:message_templates(id, name, channel)').order('created_at', { ascending: false }),
  ])

  return (
    <AutomationClient
      initialTemplates={(templatesRes.data as MessageTemplate[]) ?? []}
      initialRules={(rulesRes.data as AutomationRule[]) ?? []}
      emailEnabled={isEmailConfigured()}
      smsEnabled={isSmsConfigured()}
    />
  )
}
