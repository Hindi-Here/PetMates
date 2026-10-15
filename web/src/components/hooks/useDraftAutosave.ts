import { useEffect, useRef } from 'react'
import { TIMING } from '../scripts/limits'

interface DraftAutosaveOptions<T> {
  enabled?: boolean
  hasChanges: boolean
  payload: T
  save: (payload: T) => Promise<unknown>
  discard?: () => Promise<unknown>
  hasServerDraft?: boolean
  onSaved?: () => void
  delay?: number
}

// Хук для автосохранения черновика с возможностью сохранения и отката изменений
export const useDraftAutosave = <T,>({
  enabled = true,
  hasChanges,
  payload,
  save,
  discard,
  hasServerDraft = false,
  onSaved,
  delay = TIMING.draftAutosaveMs,
}: DraftAutosaveOptions<T>) => {
  const latest = useRef({ save, discard, onSaved, payload })
  latest.current = { save, discard, onSaved, payload }

  const serverHasDraft = useRef(hasServerDraft)
  const isFirstRun = useRef(true)
  const serialized = JSON.stringify(payload)

  useEffect(() => {
    if (!enabled) return

    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }

    const timer = setTimeout(async () => {
      try {
        if (hasChanges) {
          await latest.current.save(latest.current.payload)
          serverHasDraft.current = true
          latest.current.onSaved?.()
        } else if (serverHasDraft.current && latest.current.discard) {
          await latest.current.discard()
          serverHasDraft.current = false
        }
      } catch (error) {
        console.error('Ошибка автосохранения черновика:', error)
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [enabled, hasChanges, serialized])
}