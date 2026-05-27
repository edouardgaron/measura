// components/layout/Header.tsx
'use client'

import * as React from 'react'
import Link from 'next/link'
import { Settings, LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/ui/avatar'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import type { Profile } from '@/lib/supabase/types'

interface HeaderProps {
  user: Profile
  locale: 'fr' | 'en'
}

export function Header({ user, locale }: HeaderProps) {
  const displayName = user.full_name ?? user.company_name ?? user.id.slice(0, 8)

  async function handleLogout() {
    // POST to the sign-out route handler
    await fetch('/auth/signout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-950 shrink-0">
      {/* Logo — visible on mobile (desktop sidebar already shows it) */}
      <Link
        href="/dashboard"
        className="text-base font-bold text-blue-600 tracking-tight lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        Measura
      </Link>

      {/* Spacer on desktop so controls sit to the right */}
      <div className="hidden lg:flex flex-1" />

      <div className="flex items-center gap-3">
        <LanguageSwitcher currentLocale={locale} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open user menu"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <UserAvatar
                src={user.avatar_url}
                name={displayName}
                size="sm"
              />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="px-2 py-2">
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 leading-tight truncate">
                {displayName}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
                {user.role}
              </p>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={handleLogout}
              className="text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300 focus:bg-red-50 dark:focus:bg-red-950/30 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
