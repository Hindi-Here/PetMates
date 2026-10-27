import { useRef, useCallback } from 'react'

// Не даёт запустить одно и то же действие повторно, пока предыдущее не завершилось
export const useOnce = () => {
  const inFlight = useRef(new Set<string>())
  return useCallback(async <T,>(key: string, fn: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current.has(key)) return undefined
    inFlight.current.add(key)
    try { return await fn() } finally { inFlight.current.delete(key) }
  }, [])
}