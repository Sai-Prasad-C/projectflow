import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeContext, THEME_STORAGE_KEY, applyTheme } from './theme-context'
import type { ThemeMode } from './theme-context'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null
    return stored ?? 'system'
  })

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    // When preference is 'system', watch OS preference changes and re-resolve.
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = (next: ThemeMode) => {
    localStorage.setItem(THEME_STORAGE_KEY, next)
    setThemeState(next)
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
