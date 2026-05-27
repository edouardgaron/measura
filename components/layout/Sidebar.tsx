// components/layout/Sidebar.tsx
'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Settings,
  Shield,
  Menu,
  X,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { UserRole } from '@/lib/supabase/types'

interface NavItem {
  label: string
  labelFr: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[] | 'all'
  dividerBefore?: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Tableau de bord',
    labelFr: 'Tableau de bord',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: 'all',
  },
  {
    label: 'Projets',
    labelFr: 'Projets',
    href: '/dashboard/projects',
    icon: FolderOpen,
    roles: 'all',
  },
  {
    label: 'Clients',
    labelFr: 'Clients',
    href: '/dashboard/clients',
    icon: Users,
    roles: ['entrepreneur', 'admin'],
  },
  {
    label: 'Entreprise',
    labelFr: 'Entreprise',
    href: '/dashboard/settings/company',
    icon: Building2,
    roles: ['entrepreneur', 'admin'],
    dividerBefore: true,
  },
  {
    label: 'Paramètres',
    labelFr: 'Paramètres',
    href: '/dashboard/settings',
    icon: Settings,
    roles: 'all',
  },
  {
    label: 'Administration',
    labelFr: 'Administration',
    href: '/dashboard/admin',
    icon: Shield,
    roles: ['admin'],
  },
]

function isAllowed(item: NavItem, role: UserRole): boolean {
  if (item.roles === 'all') return true
  return item.roles.includes(role)
}

interface SidebarProps {
  role: UserRole
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const visibleItems = NAV_ITEMS.filter((item) => isAllowed(item, role))

  const NavLinks = () => (
    <nav aria-label="Main navigation" className="flex flex-col gap-1 px-3">
      {visibleItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <React.Fragment key={item.href}>
            {item.dividerBefore && (
              <div className="my-2 border-t border-neutral-200 dark:border-neutral-800" />
            )}
            <Link
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-neutral-400 dark:text-neutral-500'
                )}
              />
              {item.labelFr}
              {item.roles !== 'all' && (
                <span className="sr-only">({Array.isArray(item.roles) ? item.roles.join(', ') : item.roles})</span>
              )}
            </Link>
          </React.Fragment>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Mobile toggle button - rendered inside header area via fixed positioning */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
        className={cn(
          'fixed top-3.5 left-4 z-40 rounded-md p-1.5',
          'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          'lg:hidden'
        )}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white dark:bg-neutral-950',
          'border-r border-neutral-200 dark:border-neutral-800 shadow-xl',
          'transform transition-transform duration-200 ease-in-out',
          'lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Mobile sidebar"
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-800">
          <span className="text-base font-bold text-blue-600 tracking-tight">Measura</span>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className={cn(
              'rounded-md p-1',
              'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks />
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col w-60 shrink-0',
          'h-full bg-white dark:bg-neutral-950',
          'border-r border-neutral-200 dark:border-neutral-800'
        )}
        aria-label="Sidebar navigation"
      >
        <div className="flex h-14 items-center px-6 border-b border-neutral-200 dark:border-neutral-800">
          <span className="text-base font-bold text-blue-600 tracking-tight">Measura</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks />
        </div>
      </aside>
    </>
  )
}
