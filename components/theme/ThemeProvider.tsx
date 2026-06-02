// components/theme/ThemeProvider.tsx
'use client'

import * as React from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'measura-theme'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolved: 'light' | 'dark'
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(theme: Theme) {
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', isDark)
  return isDark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>('system')
  const [resolved, setResolved] = React.useState<'light' | 'dark'>('light')

  // Hydrate from storage once on mount
  React.useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system'
    setThemeState(stored)
    setResolved(applyTheme(stored) as 'light' | 'dark')
  }, [])

  // React to OS changes while in "system" mode
  React.useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setResolved(applyTheme('system') as 'light' | 'dark')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next)
    localStorage.setItem(STORAGE_KEY, next)
    setResolved(applyTheme(next) as 'light' | 'dark')
  }, [])

  const value = React.useMemo(
    () => ({ theme, setTheme, resolved }),
    [theme, setTheme, resolved]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

/** Inline script (no-FOUC): sets the `.dark` class before first paint. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`
