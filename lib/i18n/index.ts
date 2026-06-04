// lib/i18n/index.ts
// ============================================================
// Internationalisation FR/EN (ChantierPro 360).
// Approche légère et robuste (sans routing par locale) : un dictionnaire
// plat + une fonction t(). La locale est lue d'un cookie (serveur) et d'un
// localStorage (client) → fonctionne dans Server ET Client Components.
// FR est le défaut (marché Québec) ; EN pour l'expansion canadienne.
// Ajouter une clé = l'ajouter dans `fr` et `en`.
// ============================================================

export type Locale = 'fr' | 'en'
export const LOCALES: Locale[] = ['fr', 'en']
export const DEFAULT_LOCALE: Locale = 'fr'
export const LOCALE_COOKIE = 'cp-locale'

export const LOCALE_LABELS: Record<Locale, string> = { fr: 'Français', en: 'English' }

const fr = {
  // Navigation
  'nav.dashboard': 'Tableau de bord',
  'nav.field': 'Ma journée',
  'nav.projects': 'Projets',
  'nav.sales': 'Ventes',
  'nav.operations': 'Opérations',
  'nav.finance': 'Finances',
  'nav.pipeline': 'Pipeline',
  'nav.aiFollowups': 'Suivi IA',
  'nav.clients': 'Clients',
  'nav.calendar': 'Calendrier',
  'nav.team': 'Équipe',
  'nav.inventory': 'Inventaire',
  'nav.marketplace': 'Marketplace',
  'nav.automation': 'Automatisation',
  'nav.expenses': 'Dépenses',
  'nav.profitability': 'Rentabilité',
  'nav.reports': 'Rapports',
  'nav.accounting': 'Comptabilité',
  'nav.new': 'Nouveau',
  'nav.account': 'Mon compte',
  'nav.settings': 'Paramètres',
  'nav.signout': 'Se déconnecter',
  // Commun
  'common.newProject': 'Nouveau projet',
  'common.newClient': 'Nouveau client',
  'common.viewAll': 'Voir tous',
  'common.language': 'Langue',
  // Tableau de bord
  'dash.welcome': 'Bienvenue',
  'dash.subtitle': 'Votre activité {app} en un coup d’œil.',
  'dash.finance': 'Finances',
  'dash.operations': 'Opérations',
  'dash.revenueMonth': 'Revenus encaissés (mois)',
  'dash.collectedLife': 'Encaissé à vie : {v}',
  'dash.signedMonth': 'Valeur signée (mois)',
  'dash.acceptedCount': '{n} soumission(s) acceptée(s)',
  'dash.unpaid': 'Factures impayées',
  'dash.openInvoices': '{n} facture(s) ouverte(s)',
  'dash.overdue': 'En retard',
  'dash.overdueInvoices': '{n} facture(s) en retard',
  'dash.activeJobs': 'Chantiers actifs',
  'dash.totalCount': '{n} au total',
  'dash.completedJobs': 'Chantiers terminés',
  'dash.estimatesSent': 'Soumissions envoyées',
  'dash.acceptedShort': '{n} acceptée(s)',
  'dash.conversion': 'Taux de conversion',
  'dash.conversionSub': 'soumissions acceptées / envoyées',
  'dash.recentProjects': 'Projets récents',
  'dash.noProjects': 'Aucun projet pour l’instant',
  'dash.noProjectsSub': 'Créez votre premier projet pour commencer.',
  'dash.noAddress': 'Adresse non spécifiée',
  // Auth
  'auth.tagline': 'La plateforme tout-en-un des entrepreneurs',
} as const

type Key = keyof typeof fr

const en: Record<Key, string> = {
  'nav.dashboard': 'Dashboard',
  'nav.field': 'My day',
  'nav.projects': 'Projects',
  'nav.sales': 'Sales',
  'nav.operations': 'Operations',
  'nav.finance': 'Finance',
  'nav.pipeline': 'Pipeline',
  'nav.aiFollowups': 'AI follow-ups',
  'nav.clients': 'Clients',
  'nav.calendar': 'Calendar',
  'nav.team': 'Team',
  'nav.inventory': 'Inventory',
  'nav.marketplace': 'Marketplace',
  'nav.automation': 'Automation',
  'nav.expenses': 'Expenses',
  'nav.profitability': 'Profitability',
  'nav.reports': 'Reports',
  'nav.accounting': 'Accounting',
  'nav.new': 'New',
  'nav.account': 'My account',
  'nav.settings': 'Settings',
  'nav.signout': 'Sign out',
  'common.newProject': 'New project',
  'common.newClient': 'New client',
  'common.viewAll': 'View all',
  'common.language': 'Language',
  'dash.welcome': 'Welcome',
  'dash.subtitle': 'Your {app} activity at a glance.',
  'dash.finance': 'Finance',
  'dash.operations': 'Operations',
  'dash.revenueMonth': 'Revenue collected (month)',
  'dash.collectedLife': 'Collected lifetime: {v}',
  'dash.signedMonth': 'Signed value (month)',
  'dash.acceptedCount': '{n} accepted quote(s)',
  'dash.unpaid': 'Unpaid invoices',
  'dash.openInvoices': '{n} open invoice(s)',
  'dash.overdue': 'Overdue',
  'dash.overdueInvoices': '{n} overdue invoice(s)',
  'dash.activeJobs': 'Active jobs',
  'dash.totalCount': '{n} total',
  'dash.completedJobs': 'Completed jobs',
  'dash.estimatesSent': 'Quotes sent',
  'dash.acceptedShort': '{n} accepted',
  'dash.conversion': 'Conversion rate',
  'dash.conversionSub': 'accepted / sent quotes',
  'dash.recentProjects': 'Recent projects',
  'dash.noProjects': 'No projects yet',
  'dash.noProjectsSub': 'Create your first project to get started.',
  'dash.noAddress': 'No address specified',
  'auth.tagline': 'The all-in-one platform for contractors',
}

const DICT: Record<Locale, Record<Key, string>> = { fr, en }

export function normalizeLocale(v: string | null | undefined): Locale {
  return v === 'en' ? 'en' : 'fr'
}

/** Traduit une clé, avec interpolation {var}. */
export function t(locale: Locale, key: Key, vars?: Record<string, string | number>): string {
  let s: string = DICT[locale]?.[key] ?? DICT[DEFAULT_LOCALE][key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
  return s
}

/** Crée un traducteur lié à une locale : const T = makeT(locale); T('nav.projects'). */
export function makeT(locale: Locale) {
  return (key: Key, vars?: Record<string, string | number>) => t(locale, key, vars)
}

export type TranslationKey = Key
