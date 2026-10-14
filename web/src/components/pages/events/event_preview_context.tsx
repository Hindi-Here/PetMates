import { createContext, useContext } from 'react'

interface EventPreviewContextValue {
  isPreview: boolean
  setPreview: (value: boolean) => void
}

// Контекст для управления режимом предпросмотра мероприятия (редактирование/предпросмотр)
export const EventPreviewContext = createContext<EventPreviewContextValue>({
  isPreview: false,
  setPreview: () => {},
})

export const useEventPreview = () => useContext(EventPreviewContext)