import { useContext } from 'react'
import { ThemeContext } from '../context/theme-context'
import type { ThemeMode } from '../context/theme-context'

export type { ThemeMode }

export function useTheme() {
  return useContext(ThemeContext)
}
