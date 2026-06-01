// lib/messaging/render.ts
// ============================================================
// Substitution de variables {{cle}} dans les modèles de message.
// ============================================================

export type TemplateVars = Record<string, string | null | undefined>

/** Remplace les {{cle}} par leur valeur ; les clés inconnues sont vidées. */
export function renderTemplate(text: string, vars: TemplateVars): string {
  if (!text) return ''
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key]
    return v == null ? '' : String(v)
  })
}

/** Variables standard disponibles pour un lead. */
export function leadVars(lead: {
  name?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  address_city?: string | null
  estimated_value?: number | null
}, companyName?: string | null): TemplateVars {
  return {
    name: lead.name ?? '',
    contact_name: lead.contact_name ?? '',
    contact_email: lead.contact_email ?? '',
    contact_phone: lead.contact_phone ?? '',
    city: lead.address_city ?? '',
    value: lead.estimated_value != null ? String(lead.estimated_value) : '',
    company: companyName ?? '',
  }
}

/** Liste des variables documentées (pour l'UI). */
export const AVAILABLE_VARS = [
  '{{contact_name}}', '{{name}}', '{{city}}', '{{value}}', '{{company}}', '{{contact_phone}}', '{{contact_email}}',
]
