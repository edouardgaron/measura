// components/layout/LanguageSwitcher.tsx
'use client'

import { cn } from '@/lib/utils/cn'

interface LanguageSwitcherProps {
  currentLocale: 'fr' | 'en'
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  function switchLocale(locale: 'fr' | 'en') {
    if (locale === currentLocale) return
    // Set locale cookie (1 year)
    document.cookie = `locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    window.location.reload()
  }

  return (
    <div
      role="group"
      aria-label="Language switcher"
      className="flex items-center rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden"
    >
      {(['fr', 'en'] as const).map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => switchLocale(locale)}
          aria-pressed={locale === currentLocale}
          className={cn(
            'px-2.5 py-1 text-xs font-medium transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500',
            locale === currentLocale
              ? 'bg-blue-600 text-white'
              : 'bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800'
          )}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
