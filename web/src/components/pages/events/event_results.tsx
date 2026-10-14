import './event_description.scss'
import '../project.scss'

import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../scripts/query/queryKeys'
import { eventApi, type EventDetails } from '../../services/event'
import { EventMarkdownEditor } from './event_markdown_editor'
import { EventFooter } from './event_footer'
import { useEffect, useMemo, useState } from 'react'
import { useDraftAutosave } from '../../hooks/useDraftAutosave'

const MAX_RESULTS = 20000

interface EventResultsProps {
  event: EventDetails
  profileId: string
  draft?: string | null
  onDraftChange?: (value: string) => void
}

// Компонент для отображения и редактирования результатов мероприятия
export const EventResults = ({ event, profileId, draft, onDraftChange }: EventResultsProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [initial, setInitial] = useState(event.results ?? '')
  const [value, setValue] = useState(draft ?? event.results ?? '')

  const tooLong = value.length > MAX_RESULTS
  const hasChanges = useMemo(() => value !== initial, [value, initial])

  useEffect(() => {
    onDraftChange?.(value)
  }, [value])

  useDraftAutosave({
    hasChanges,
    payload: value,
    hasServerDraft: draft != null,
    save: data => eventApi.saveDraft(event.eventId, 'results', data),
    discard: () => eventApi.discardDraft(event.eventId, 'results'),
  })

  const handleSave = async () => {
    if (!hasChanges || tooLong || isSaving) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const saved = await eventApi.updateResults(event.eventId, value)
      const next = saved.results ?? ''
      setInitial(next)
      setValue(next)
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Не удалось сохранить результаты')
      setTimeout(() => setSaveError(null), 4000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleBack = () => navigate(`/profile/${profileId}/activity?section=events`, { replace: true })

  return (
    <>
      <section className='project-section'>
        <div className='section-header-wrapper'>
          <h2 className='project-section-title'>Результаты</h2>
          {hasChanges && <span className='draft-indicator'>(черновик)</span>}
          <span className={`event-char-counter ${tooLong ? 'limit' : ''}`}>
            {value.length} / {MAX_RESULTS}
          </span>
        </div>

        <EventMarkdownEditor
          eventId={event.eventId}
          section="results"
          value={value}
          onChange={setValue}
          hasError={tooLong}
          emptyPreviewText='Результаты пока не заполнены'
          placeholder={'### Итоги мероприятия\n\nУкажите финалистов, поздравления и награды.\n\n- 1 место: Участник ...\n- 2 место: Участник ...'}
        />
        {tooLong && <p className='event-field-error'>Максимум {MAX_RESULTS} символов</p>}
      </section>

      <EventFooter
        canSave={hasChanges && !tooLong}
        canCancel={hasChanges}
        isSaving={isSaving}
        onSave={handleSave}
        onCancel={() => setValue(initial)}
        onBack={handleBack}
        saveError={saveError}
        onErrorEnd={() => setSaveError(null)}
        saveSuccess={saveSuccess}
        successText='Результаты сохранены'
        onSuccessEnd={() => setSaveSuccess(false)}
      />
    </>
  )
}