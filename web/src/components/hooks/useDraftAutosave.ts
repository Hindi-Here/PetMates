import { useCallback, useEffect, useRef } from 'react'
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

// Хук для автосохранения
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
  
  const latest = useRef({ save, discard, onSaved, payload, hasChanges })
  latest.current = { save, discard, onSaved, payload, hasChanges }

  const serverHasDraft = useRef(hasServerDraft)
  useEffect(() => { 
    serverHasDraft.current = hasServerDraft 
  }, [hasServerDraft])

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const paused = useRef(false)
  const isFirstRun = useRef(true)
  
  const serialized = JSON.stringify(payload)

  const enqueue = (fn: () => Promise<unknown>) => {
    queue.current = queue.current
      .then(fn)
      .catch(e => console.error('Ошибка автосохранения черновика:', e))
  }

  useEffect(() => {
    if (!enabled || paused.current) return
    if (isFirstRun.current) { 
      isFirstRun.current = false
      return 
    }

    timer.current = setTimeout(() => enqueue(async () => {
      if (paused.current) return
      
      const cur = latest.current
      if (cur.hasChanges) {
        await cur.save(cur.payload)
        serverHasDraft.current = true
        cur.onSaved?.()
      } else if (serverHasDraft.current && cur.discard) {
        await cur.discard()
        serverHasDraft.current = false
      }
    }), delay)

    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
      }
    }
  }, [enabled, hasChanges, serialized, delay])

  const pause = useCallback(async () => {
    paused.current = true
    if (timer.current) {
      clearTimeout(timer.current)
    }
    await queue.current
  }, [])

  const resume = useCallback((draftStillExists = false) => {
    serverHasDraft.current = draftStillExists
    paused.current = false
  }, [])

  return { pause, resume }
}