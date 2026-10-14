import './event_form.scss'
import './event_description.scss'
import '../project.scss'

import Add from '@icons/plus.svg?react'
import Delete from '@icons/delete.svg?react'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../scripts/query/queryKeys'
import { eventApi, type EventDetails, type EventFormField } from '../../services/event'
import { EventFooter } from './event_footer'
import { useDraftAutosave } from '../../hooks/useDraftAutosave'

const MAX_FIELDS = 50
const MAX_LABEL = 100

let fieldCounter = 0
const newFieldId = () => `f-${Date.now().toString(36)}${(fieldCounter++).toString(36)}`

const clean = (fields: EventFormField[]) =>
  fields.map(f => ({ id: f.id, label: f.label.trim(), required: !!f.required }))

const validate = (fields: EventFormField[]): Record<string, string> => {
  const errors: Record<string, string> = {}
  const used = new Set<string>()

  fields.forEach(f => {
    const label = f.label.trim()
    if (!label) {
      errors[f.id] = 'Введите название критерия'
      return
    }
    if (label.length > MAX_LABEL) {
      errors[f.id] = `Максимум ${MAX_LABEL} символов`
      return
    }
    const key = label.toLowerCase()
    if (used.has(key)) errors[f.id] = 'Такой критерий уже есть'
    used.add(key)
  })

  return errors
}

interface EventFormProps {
  event: EventDetails
  profileId: string
  draft?: EventFormField[] | null
  onDraftChange?: (fields: EventFormField[]) => void
}

// Компонент для отображения и редактирования формы мероприятия
export const EventForm = ({ event, profileId, draft, onDraftChange }: EventFormProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [initial, setInitial] = useState<EventFormField[]>(() => event.applicationForm ?? [])
  const [fields, setFields] = useState<EventFormField[]>(() => draft ?? event.applicationForm ?? [])
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const errors = useMemo(() => validate(fields), [fields])
  const isValid = Object.keys(errors).length === 0
  const payload = useMemo(() => clean(fields), [fields])
  const hasChanges = JSON.stringify(payload) !== JSON.stringify(clean(initial))

  useEffect(() => {
    onDraftChange?.(fields)
  }, [fields])

  useDraftAutosave({
    hasChanges,
    payload,
    hasServerDraft: !!draft,
    save: data => eventApi.saveDraft(event.eventId, 'form', data),
    discard: () => eventApi.discardDraft(event.eventId, 'form'),
  })

  const touch = (id: string) => setTouched(prev => (prev[id] ? prev : { ...prev, [id]: true }))

  const addField = () => {
    if (fields.length >= MAX_FIELDS) return
    setFields(prev => [...prev, { id: newFieldId(), label: '', required: false }])
  }

  const updateField = (id: string, patch: Partial<EventFormField>) =>
    setFields(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)))

  const removeField = (id: string) => setFields(prev => prev.filter(f => f.id !== id))

  const handleSave = async () => {
    if (!hasChanges || !isValid || isSaving) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const saved = await eventApi.updateForm(event.eventId, payload)
      setInitial(saved.applicationForm)
      setFields(saved.applicationForm)
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Не удалось сохранить форму')
      setTimeout(() => setSaveError(null), 4000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFields(initial)
    setTouched({})
  }

  const handleBack = () => navigate(`/profile/${profileId}/activity?section=events`, { replace: true })

  return (
    <>
      <section className='project-section'>
        <div className='section-header-wrapper'>
          <h2 className='project-section-title'>Форма заявки</h2>
          {hasChanges && <span className='draft-indicator'>(черновик)</span>}
        </div>

        {fields.length === 0 && (
          <div className='event-form-empty'>
            Полей пока нет. Пользователи смогут подать заявку без вопросов.
          </div>
        )}

        <div className='event-form-list'>
          {fields.map(field => {
            const error = touched[field.id] ? errors[field.id] : undefined
            return (
              <div key={field.id} className='event-form-item'>
                <div className='event-form-item-head'>
                  <input
                    className={`project-field-input ${error ? 'input-error' : ''}`}
                    placeholder='Критерий (например, «Ссылка на портфолио»)'
                    value={field.label}
                    maxLength={MAX_LABEL}
                    onChange={e => { updateField(field.id, { label: e.target.value }); touch(field.id) }}
                    onBlur={() => touch(field.id)}
                  />
                  <button type='button' className='member-remove-badge' onClick={() => removeField(field.id)}>
                    <Delete className='ico' />
                  </button>
                </div>
                {error && <p className='event-field-error'>{error}</p>}
                <input className='project-field-input' disabled placeholder='Поле для ответа пользователя' />
                <label className='event-checkbox'>
                  <input
                    type='checkbox'
                    checked={field.required}
                    onChange={e => updateField(field.id, { required: e.target.checked })}
                  />
                  <span>Обязательное поле</span>
                </label>
              </div>
            )
          })}
        </div>

        <button type='button' className='event-add-stage-btn' onClick={addField} disabled={fields.length >= MAX_FIELDS}>
          <Add className='event-add-stage-ico' />
          <span>Добавить поле</span>
        </button>
      </section>

      <EventFooter
        canSave={hasChanges && isValid}
        canCancel={hasChanges}
        isSaving={isSaving}
        onSave={handleSave}
        onCancel={handleCancel}
        onBack={handleBack}
        saveError={saveError}
        onErrorEnd={() => setSaveError(null)}
        saveSuccess={saveSuccess}
        successText='Форма заявки сохранена'
        onSuccessEnd={() => setSaveSuccess(false)}
      />
    </>
  )
}