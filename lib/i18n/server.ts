// lib/i18n/server.ts
// Lecture de la locale côté serveur (cookie), pour les Server Components.
import { cookies } from 'next/headers'
import { LOCALE_COOKIE, normalizeLocale, type Locale } from '@/lib/i18n'

export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value)
}
