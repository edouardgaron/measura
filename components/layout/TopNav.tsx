// components/layout/TopNav.tsx
'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Plus,
  ChevronDown,
  Menu,
  Settings,
  LogOut,
  HelpCircle,
  MessageCircle,
  SlidersHorizontal,
  Building2,
  Shield,
  Upload,
  UserPlus,
  Sparkles,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils/cn'
import type { Profile, UserRole } from '@/lib/supabase/types'
import { makeT, normalizeLocale, type Locale, type TranslationKey } from '@/lib/i18n'
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher'

interface NavLink {
  label: TranslationKey
  href: string
  roles: UserRole[] | 'all'
}

interface NavGroup {
  label: TranslationKey
  roles: UserRole[] | 'all'
  items: NavLink[]
}

// Direct top-level links (always visible, kept minimal like Hover)
const PRIMARY_LINKS: NavLink[] = [
  { label: 'nav.dashboard', href: '/dashboard', roles: 'all' },
  { label: 'nav.field', href: '/field', roles: 'all' },
  { label: 'nav.projects', href: '/projects', roles: 'all' },
]

// Everything else grouped behind compact dropdowns
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'nav.sales',
    roles: ['entrepreneur', 'admin'],
    items: [
      { label: 'nav.pipeline', href: '/crm', roles: ['entrepreneur', 'admin'] },
      { label: 'nav.aiFollowups', href: '/follow-ups', roles: ['entrepreneur', 'admin'] },
      { label: 'nav.clients', href: '/clients', roles: ['entrepreneur', 'admin'] },
      { label: 'nav.calendar', href: '/schedule', roles: ['entrepreneur', 'admin'] },
    ],
  },
  {
    label: 'nav.operations',
    roles: ['entrepreneur', 'admin'],
    items: [
      { label: 'nav.team', href: '/team', roles: ['entrepreneur', 'admin'] },
      { label: 'nav.inventory', href: '/inventory', roles: ['entrepreneur', 'admin'] },
      { label: 'nav.marketplace', href: '/marketplace', roles: ['entrepreneur', 'admin'] },
      { label: 'nav.automation', href: '/automations', roles: ['entrepreneur', 'admin'] },
    ],
  },
  {
    label: 'nav.finance',
    roles: ['entrepreneur', 'admin'],
    items: [
      { label: 'nav.expenses', href: '/expenses', roles: ['entrepreneur', 'admin'] },
      { label: 'nav.profitability', href: '/profitability', roles: ['entrepreneur', 'admin'] },
      { label: 'nav.reports', href: '/reports', roles: ['entrepreneur', 'admin'] },
      { label: 'nav.accounting', href: '/accounting', roles: ['entrepreneur', 'admin'] },
    ],
  },
]

function allowed(roles: UserRole[] | 'all', role: UserRole): boolean {
  return roles === 'all' || roles.includes(role)
}

interface TopNavProps {
  user: Profile
  email?: string | null
  locale?: Locale
}

export function TopNav({ user, email = null, locale = 'fr' }: TopNavProps) {
  const pathname = usePathname()
  const role = user.role
  const displayName = user.full_name ?? user.company_name ?? user.id.slice(0, 8)
  const T = makeT(normalizeLocale(locale))

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  async function handleLogout() {
    await fetch('/auth/signout', { method: 'POST' })
    window.location.href = '/login'
  }

  const groups = NAV_GROUPS.filter((g) => allowed(g.roles, role))
  const primary = PRIMARY_LINKS.filter((l) => allowed(l.roles, role))

  return (
    <header className="sticky top-0 z-30 h-16 w-full border-b border-neutral-200/70 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto flex h-full max-w-[1600px] items-center gap-1 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="mr-4 text-xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100"
        >
          ChantierPro&nbsp;360
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Navigation principale">
          {primary.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                isActive(link.href)
                  ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
              )}
            >
              {T(link.label)}
            </Link>
          ))}

          {groups.map((group) => {
            const items = group.items.filter((i) => allowed(i.roles, role))
            if (items.length === 0) return null
            const groupActive = items.some((i) => isActive(i.href))
            return (
              <DropdownMenu key={T(group.label)}>
                <DropdownMenuTrigger
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium outline-none transition-colors',
                    groupActive
                      ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
                  )}
                >
                  {T(group.label)}
                  <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {items.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href} className="cursor-pointer">
                        {T(item.label)}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <NouveauMenu />

          {/* Mobile menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 md:hidden"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {primary.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link href={link.href} className="cursor-pointer">{T(link.label)}</Link>
                </DropdownMenuItem>
              ))}
              {groups.map((group) => {
                const items = group.items.filter((i) => allowed(i.roles, role))
                if (items.length === 0) return null
                return (
                  <React.Fragment key={T(group.label)}>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>{T(group.label)}</DropdownMenuLabel>
                    {items.map((item) => (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link href={item.href} className="cursor-pointer">{T(item.label)}</Link>
                      </DropdownMenuItem>
                    ))}
                  </React.Fragment>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Account menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
              aria-label="Menu du compte"
            >
              <UserAvatar src={user.avatar_url} name={displayName} size="md" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <div className="px-2 py-2">
                <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{displayName}</p>
                {email && <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{email}</p>}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <SlidersHorizontal className="h-4 w-4" />
                  Préférences d&apos;estimation
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="h-4 w-4" />
                  {T('nav.settings')}
                </Link>
              </DropdownMenuItem>
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">{T('common.language')}</span>
                <LanguageSwitcher variant="inline" />
              </div>
              {(role === 'entrepreneur' || role === 'admin') && (
                <DropdownMenuItem asChild>
                  <Link href="/settings/company" className="cursor-pointer">
                    <Building2 className="h-4 w-4" />
                    Entreprise
                  </Link>
                </DropdownMenuItem>
              )}
              {role === 'admin' && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="cursor-pointer">
                    <Shield className="h-4 w-4" />
                    Administration
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="mailto:support@measura.app" className="cursor-pointer">
                  <HelpCircle className="h-4 w-4" />
                  Centre d&apos;aide
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="mailto:support@measura.app" className="cursor-pointer">
                  <MessageCircle className="h-4 w-4" />
                  Clavardage en direct
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleLogout}
                className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                {T('nav.signout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

// "+ Nouveau" dropdown — two-line items like Hover
function NouveauMenu() {
  const items = [
    {
      icon: Upload,
      title: 'Téléverser un plan',
      desc: 'Obtenir des mesures et des métrés à partir d’un fichier',
      href: '/projects/new',
    },
    {
      icon: UserPlus,
      title: 'Inviter à capturer',
      desc: 'Demander à quelqu’un de prendre des photos',
      href: '/invite',
    },
    {
      icon: Sparkles,
      title: 'Idées de design',
      desc: 'Créer un nouveau projet de design',
      href: '/projects/new',
    },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-900 px-4 text-sm font-medium text-white outline-none transition-colors hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 dark:focus-visible:ring-neutral-100 dark:focus-visible:ring-offset-neutral-950">
        <Plus className="h-4 w-4" />
        Nouveau
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        {items.map((item, i) => {
          const Icon = item.icon
          return (
            <DropdownMenuItem key={i} asChild>
              <Link
                href={item.href}
                className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-neutral-900 dark:text-neutral-100" />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{item.title}</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">{item.desc}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
