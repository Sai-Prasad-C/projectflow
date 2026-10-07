import { createContext } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'pf-theme'

// Must stay in sync with --color-bg tokens in index.css and the bootstrap
// script in index.html.
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#F7F7FC',
  dark:  '#0B0B12',
}

export interface ThemeContextValue {
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
})

export function getOsTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(pref: ThemeMode): ResolvedTheme {
  return pref === 'system' ? getOsTheme() : pref
}

export function applyTheme(pref: ThemeMode) {
  const resolved = resolveTheme(pref)
  const root = document.documentElement
  root.setAttribute('data-theme', resolved)
  root.style.colorScheme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLORS[resolved])
}
