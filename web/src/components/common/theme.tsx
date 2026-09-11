import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface ThemeContextType {
  isDarkTheme: boolean
  setIsDarkTheme: (value: boolean) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme')
      if (saved) return saved === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
 })

  useEffect(() => {
    const root = document.documentElement
    if (isDarkTheme) {
      root.setAttribute('data-theme', 'dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.setAttribute('data-theme', 'light')
      localStorage.setItem('theme', 'light')
    }
  }, [isDarkTheme])

  return (
    <ThemeContext.Provider value={{ isDarkTheme, setIsDarkTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}