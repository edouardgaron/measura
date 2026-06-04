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
  'nav.newUpload': 'Téléverser un plan',
  'nav.newUploadDesc': 'Obtenir des mesures et des métrés à partir d’un fichier',
  'nav.newInvite': 'Inviter à capturer',
  'nav.newInviteDesc': 'Demander à quelqu’un de prendre des photos',
  'nav.newDesign': 'Idées de design',
  'nav.newDesignDesc': 'Créer un nouveau projet de design',
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
  // Projets (liste)
  'projects.search': 'Rechercher une propriété, adresse ou nom',
  'projects.filters': 'Filtres',
  'projects.status.all': 'Tous',
  'projects.status.draft': 'Brouillon',
  'projects.status.photos_pending': 'Photos nécessaires',
  'projects.status.measuring': 'En mesure',
  'projects.status.review': 'En révision',
  'projects.status.completed': 'Complété',
  'projects.status.archived': 'Archivé',
  'projects.empty.noMatch': 'Aucun projet ne correspond',
  'projects.empty.noMatchSub': 'Essayez un autre filtre ou une autre recherche.',
  'projects.empty.none': "Aucun projet pour l'instant",
  'projects.empty.noneSub': 'Créez votre premier projet pour commencer à prendre des mesures.',
  'projects.new': 'Nouveau projet',
  // Clients
  'clients.title': 'Clients',
  'clients.total': '{n} client(s) au total',
  'clients.empty.title': "Aucun client pour l'instant",
  'clients.empty.sub': 'Vos clients apparaîtront ici une fois que vous les aurez invités à un projet.',
  'clients.empty.cta': 'Créer un projet',
  'clients.projects': '{n} projet(s)',
  'clients.more': '+{n} autres projets',
  'clients.sendEmail': 'Envoyer un courriel',
  // Paramètres
  'settings.title': 'Paramètres',
  'settings.subtitle': 'Gérez votre profil et les informations de votre entreprise',
  'settings.appearance': 'Apparence',
  'settings.appearanceSub': 'Choisissez le thème clair, sombre ou selon votre système',
  'theme.light': 'Clair',
  'theme.dark': 'Sombre',
  'theme.system': 'Système',
  'settings.tab.profile': 'Profil',
  'settings.tab.company': 'Entreprise',
  'settings.personalInfo': 'Informations personnelles',
  'settings.personalInfoSub': 'Mettez à jour votre nom et vos coordonnées',
  'settings.fullName': 'Nom complet',
  'settings.phone': 'Téléphone',
  'settings.save': 'Sauvegarder',
  'settings.saved': 'Sauvegardé',
  'settings.savedDesc': 'Vos paramètres ont été mis à jour.',
  'settings.error': 'Erreur',
  'settings.companyTitle': "Paramètres de l'entreprise",
  'settings.companySub': "Logo, taxes, prix par défaut, membres de l'équipe et abonnement",
  'settings.configureCompany': "Configurer l'entreprise",
  'settings.configureCompanySub': 'Logo, taxes, équipe et abonnement',
  'settings.dangerZone': 'Zone dangereuse',
  'settings.dangerText': 'Une fois votre compte supprimé, toutes vos données seront perdues de façon permanente.',
  'settings.deleteAccount': 'Supprimer mon compte',
  'settings.deleteConfirm': 'Êtes-vous sûr de vouloir supprimer votre compte? Cette action est irréversible.',
  'settings.contactSupport': 'Contactez le support',
  'settings.contactSupportDesc': 'Veuillez contacter support@measura.app pour supprimer votre compte.',
  // Ma journée (field)
  'field.hello': 'Bonjour',
  'field.jobsCount': 'chantier(s)',
  'field.hoursToday': 'pointées aujourd’hui',
  'field.dispatchNote': 'Vue dispatch (aucun profil employé lié à ce compte).',
  'field.noJobs': 'Aucun chantier prévu aujourd’hui',
  'field.noJobsSub': 'Profitez-en ou consultez le calendrier.',
  'field.viewCalendar': 'Voir le calendrier complet →',
  'field.inProgress': 'En cours',
  'field.route': 'Itinéraire',
  'field.hoursPlanned': '{n} h prévues',
  'field.project': 'Projet',
  'field.noClock': 'Aucun projet lié — pointage indisponible',
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
  'nav.newUpload': 'Upload a plan',
  'nav.newUploadDesc': 'Get measurements and takeoffs from a file',
  'nav.newInvite': 'Invite to capture',
  'nav.newInviteDesc': 'Ask someone to take photos',
  'nav.newDesign': 'Design ideas',
  'nav.newDesignDesc': 'Create a new design project',
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
  'projects.search': 'Search a property, address or name',
  'projects.filters': 'Filters',
  'projects.status.all': 'All',
  'projects.status.draft': 'Draft',
  'projects.status.photos_pending': 'Photos needed',
  'projects.status.measuring': 'Measuring',
  'projects.status.review': 'In review',
  'projects.status.completed': 'Completed',
  'projects.status.archived': 'Archived',
  'projects.empty.noMatch': 'No matching project',
  'projects.empty.noMatchSub': 'Try another filter or search.',
  'projects.empty.none': 'No projects yet',
  'projects.empty.noneSub': 'Create your first project to start measuring.',
  'projects.new': 'New project',
  'clients.title': 'Clients',
  'clients.total': '{n} client(s) total',
  'clients.empty.title': 'No clients yet',
  'clients.empty.sub': 'Your clients will appear here once you invite them to a project.',
  'clients.empty.cta': 'Create a project',
  'clients.projects': '{n} project(s)',
  'clients.more': '+{n} more projects',
  'clients.sendEmail': 'Send an email',
  'settings.title': 'Settings',
  'settings.subtitle': 'Manage your profile and company information',
  'settings.appearance': 'Appearance',
  'settings.appearanceSub': 'Choose the light, dark or system theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',
  'settings.tab.profile': 'Profile',
  'settings.tab.company': 'Company',
  'settings.personalInfo': 'Personal information',
  'settings.personalInfoSub': 'Update your name and contact details',
  'settings.fullName': 'Full name',
  'settings.phone': 'Phone',
  'settings.save': 'Save',
  'settings.saved': 'Saved',
  'settings.savedDesc': 'Your settings have been updated.',
  'settings.error': 'Error',
  'settings.companyTitle': 'Company settings',
  'settings.companySub': 'Logo, taxes, default pricing, team members and subscription',
  'settings.configureCompany': 'Configure company',
  'settings.configureCompanySub': 'Logo, taxes, team and subscription',
  'settings.dangerZone': 'Danger zone',
  'settings.dangerText': 'Once your account is deleted, all your data will be permanently lost.',
  'settings.deleteAccount': 'Delete my account',
  'settings.deleteConfirm': 'Are you sure you want to delete your account? This action cannot be undone.',
  'settings.contactSupport': 'Contact support',
  'settings.contactSupportDesc': 'Please contact support@measura.app to delete your account.',
  'field.hello': 'Hello',
  'field.jobsCount': 'job(s)',
  'field.hoursToday': 'logged today',
  'field.dispatchNote': 'Dispatch view (no employee profile linked to this account).',
  'field.noJobs': 'No jobs scheduled today',
  'field.noJobsSub': 'Enjoy it or check the calendar.',
  'field.viewCalendar': 'View full calendar →',
  'field.inProgress': 'In progress',
  'field.route': 'Directions',
  'field.hoursPlanned': '{n} h planned',
  'field.project': 'Project',
  'field.noClock': 'No linked project — clock-in unavailable',
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

/** Lit la locale courante côté client (cookie `cp-locale`). SSR → DEFAULT_LOCALE. */
export function getClientLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  const m = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=(\\w+)`))
  return normalizeLocale(m?.[1])
}

export type TranslationKey = Key
