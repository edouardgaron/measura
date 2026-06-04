// components/i18n/LanguageSwitcher.tsx
'use client'

import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS, normalizeLocale, type Locale } from '@/lib/i18n'

function setLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
  try { localStorage.setItem(LOCALE_COOKIE, locale) } catch { /* ignore */ }
  window.location.reload() // recharge pour que les Server Components relisent la locale
}

/** Lit la locale courante depuis le cookie (client). */
function currentLocale(): Locale {
  if (typeof document === 'undefined') return 'fr'
  const m = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=(\\w+)`))
  return normalizeLocale(m?.[1])
}

export function LanguageSwitcher({ variant = 'pill' }: { variant?: 'pill' | 'inline' }) {
  const cur = currentLocale()
  if (variant === 'inline') {
    return (
      <div className="inline-flex overflow-hidden rounded-full border border-neutral-300 dark:border-neutral-700">
        {LOCALES.map((l) => (
          <button
            key={l}
            onClick={() => l !== cur && setLocale(l)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              l === cur
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
            }`}
          >
            {LOCALE_LABELS[l]}
          </button>
        ))}
      </div>
    )
  }
  return (
    <button
      onClick={() => setLocale(cur === 'fr' ? 'en' : 'fr')}
      className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      title="Language / Langue"
    >
      {cur === 'fr' ? 'EN' : 'FR'}
    </button>
  )
}
