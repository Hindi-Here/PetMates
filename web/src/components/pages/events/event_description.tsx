import './event_description.scss'
import '../project.scss'
import '../../common/comment.scss'

import Add from '@icons/plus.svg?react'
import Delete from '@icons/delete.svg?react'
import DropdownIcon from '@icons/dropdown.svg?react'
import PrivacyIcon from '@icons/private.svg?react'
import PublicIcon from '@icons/public.svg?react'
import ImportantIcon from '@icons/important_warning.svg?react'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { Dropdown } from '../../common/dropdown'
import { DatePicker } from '../../common/datePicker'
import { CommentsSection } from '../../common/commentsSection'
import DeleteEventForm from '../../forms/delete_event'
import { useIsOpen } from '../../scripts/function'
import { queryKeys } from '../../scripts/query/queryKeys'
import { eventApi, type EventDetails, type UpdateEventDto } from '../../services/event'
import { EventMarkdownEditor } from './event_markdown_editor'
import { EventFooter } from './event_footer'
import { useDraftAutosave } from '../../hooks/useDraftAutosave'

import { LIMITS, TIMING } from '../../scripts/limits'

const STATUS_OPTIONS = ['В процессе', 'Завершён', 'Приостановлен']
const STAGE_OUT_OF_RANGE = 'Этап должен входить в период проведения'

interface StageForm {
  id: string
  title: string
  startDate: string
  endDate: string
  acceptsApplications: boolean
}

interface FormState {
  title: string
  shortDescription: string
  status: string
  isPrivate: boolean
  eventStart: string
  eventEnd: string
  stages: StageForm[]
  limit: string
  noLimit: boolean
  description: string
}

let stageCounter = 0
const newStageId = () => `stage-${Date.now()}-${stageCounter++}`

const toForm = (e: EventDetails): FormState => ({
  title: e.title,
  shortDescription: e.shortDescription ?? '',
  status: e.status,
  isPrivate: e.isPrivate,
  eventStart: e.eventStartDate ?? '',
  eventEnd: e.eventEndDate ?? '',
  stages: (e.stages ?? []).map(s => ({ id: newStageId(), ...s, acceptsApplications: !!s.acceptsApplications })),
  limit: e.participantLimit ? String(e.participantLimit) : '',
  noLimit: !e.participantLimit,
  description: e.description ?? '',
})

const payloadToForm = (d: UpdateEventDto): FormState => ({
  title: d.title,
  shortDescription: d.shortDescription,
  status: d.status,
  isPrivate: d.isPrivate,
  eventStart: d.eventStartDate ?? '',
  eventEnd: d.eventEndDate ?? '',
  stages: (d.stages ?? []).map(s => ({ id: newStageId(), ...s, acceptsApplications: !!s.acceptsApplications })),
  limit: d.participantLimit ? String(d.participantLimit) : '',
  noLimit: !d.participantLimit,
  description: d.description ?? '',
})

const toPayload = (f: FormState): UpdateEventDto => ({
  title: f.title.trim(),
  shortDescription: f.shortDescription.trim(),
  status: f.status,
  isPrivate: f.isPrivate,
  eventStartDate: f.eventStart || null,
  eventEndDate: f.eventEnd || null,
  participantLimit: f.noLimit || !f.limit ? null : Number(f.limit),
  description: f.description,
  stages: f.stages.map(s => ({
    title: s.title.trim(),
    startDate: s.startDate,
    endDate: s.endDate,
    acceptsApplications: s.acceptsApplications,
  })),
})

// Валидация формы мероприятия, проверка обязательных полей, длины текста и корректности дат
const validate = (f: FormState): Record<string, string> => {
  const errors: Record<string, string> = {}
  if (!f.title.trim()) errors.title = 'Введите название мероприятия'
  else if (f.title.trim().length > LIMITS.event.titleMax) errors.title = `Максимум ${LIMITS.event.titleMax} символов`

  if (!f.shortDescription.trim()) errors.shortDescription = 'Введите краткое описание'
  else if (f.shortDescription.trim().length > LIMITS.event.shortDescriptionMax) errors.shortDescription = `Максимум ${LIMITS.event.shortDescriptionMax} символов`

  if (!f.shortDescription.trim()) errors.shortDescription = 'Введите краткое описание'
  else if (f.shortDescription.trim().length > LIMITS.event.shortDescriptionMax) errors.shortDescription = `Максимум ${LIMITS.event.shortDescriptionMax} символов`

  const eventOk = !!f.eventStart && !!f.eventEnd && f.eventStart <= f.eventEnd
  if (!f.eventStart || !f.eventEnd) errors.event = 'Укажите даты проведения'
  else if (f.eventStart > f.eventEnd) errors.event = 'Дата окончания раньше даты начала'

  if (!f.noLimit) {
    const n = Number(f.limit)
    if (!f.limit || !Number.isInteger(n) || n < 1 || n > LIMITS.event.participantLimitMax) errors.limit = `Укажите число от 1 до ${LIMITS.event.participantLimitMax}`
  }

  f.stages.forEach(s => {
    const key = `stage:${s.id}`
    if (!s.title.trim()) errors[key] = 'Введите название этапа'
    else if (s.title.trim().length > LIMITS.event.stageTitleMax) errors[key] = `Название: максимум ${LIMITS.event.stageTitleMax} символов`
    else if (!s.startDate || !s.endDate) errors[key] = 'Укажите даты этапа'
    else if (s.startDate > s.endDate) errors[key] = 'Дата окончания раньше даты начала'
    else if (eventOk && (s.startDate < f.eventStart || s.endDate > f.eventEnd)) errors[key] = STAGE_OUT_OF_RANGE
  })

  if (f.description.length > LIMITS.longTextMax) errors.description = `Максимум ${LIMITS.longTextMax} символов`
  return errors
}

interface EventDescriptionProps {
  event: EventDetails
  profileId: string
  draft?: UpdateEventDto | null
  onDraftChange?: (dto: UpdateEventDto) => void
}

// Компонент для отображения и редактирования описания мероприятия, включая базовую информацию, этапы, лимит участников и описание с возможностью сохранения изменений и управления черновиком
export const EventDescription = ({ event, profileId, draft, onDraftChange }: EventDescriptionProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [initial, setInitial] = useState<FormState>(() => toForm(event))
  const [form, setForm] = useState<FormState>(() => (draft ? payloadToForm(draft) : toForm(event)))
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showDeleteForm, setShowDeleteForm] = useState(false)

  const { isOpen: isStatusOpen, setIsOpen: setStatusOpen, menuRef: statusMenuRef } = useIsOpen()
  const statusOptions = STATUS_OPTIONS.map(s => ({ id: s, label: s }))

  const eventsListPath = `/profile/${profileId}/activity?section=events`

  const update = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }))
  const touch = (key: string) => setTouched(prev => (prev[key] ? prev : { ...prev, [key]: true }))

  const errors = useMemo(() => validate(form), [form])
  const error = (key: string) => (touched[key] ? errors[key] : undefined)
  const stageError = (id: string) => {
    const message = errors[`stage:${id}`]
    return message && (touched[`stage:${id}`] || message === STAGE_OUT_OF_RANGE) ? message : undefined
  }
  const isValid = Object.keys(errors).length === 0

  const payload = useMemo(() => toPayload(form), [form])
  const savedPayload = useMemo(() => toPayload(initial), [initial])

  const hasChanges = JSON.stringify(payload) !== JSON.stringify(savedPayload)
  const descriptionChanged = payload.description !== savedPayload.description
  const basicChanged =
    JSON.stringify({ ...payload, description: '' }) !== JSON.stringify({ ...savedPayload, description: '' })

  useEffect(() => {
    onDraftChange?.(payload)
  }, [payload])

  useDraftAutosave({
    hasChanges,
    payload,
    hasServerDraft: !!draft,
    save: data => eventApi.saveDraft(event.eventId, 'general', data),
    discard: () => eventApi.discardDraft(event.eventId, 'general'),
  })

  const handleSave = async () => {
    if (!hasChanges || !isValid || isSaving) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const saved = await eventApi.update(event.eventId, payload)
      const next = toForm(saved)
      setInitial(next)
      setForm(next)
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), TIMING.toastMs)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Не удалось сохранить мероприятие')
      setTimeout(() => setSaveError(null), TIMING.toastMs)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setForm(initial)
    setTouched({})
  }

  const handleBack = () => navigate(eventsListPath, { replace: true })

  const addStage = () => {
    if (form.stages.length >= LIMITS.event.stagesMax) return
    update({
      stages: [...form.stages, { id: newStageId(), title: '', startDate: '', endDate: '', acceptsApplications: false }],
    })
  }

  const updateStage = (id: string, patch: Partial<StageForm>) => {
    update({ stages: form.stages.map(s => (s.id === id ? { ...s, ...patch } : s)) })
    touch(`stage:${id}`)
  }

  const removeStage = (id: string) => update({ stages: form.stages.filter(s => s.id !== id) })

  const handleDeleteSuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.events.all })
    navigate(eventsListPath, { replace: true })
  }

  const renderError = (key: string) =>
    error(key) ? <p className='event-field-error'>{error(key)}</p> : null

  const descriptionTooLong = form.description.length > LIMITS.longTextMax

  return (
    <>
      <section className='project-section'>
        <div className='section-header-wrapper'>
          <h2 className='project-section-title'>Базовая информация</h2>
          {basicChanged && <span className='draft-indicator'>(черновик)</span>}
        </div>
        <div className='project-form-grid'>
          <div className='project-field-row'>
            <label className='project-field-label'>Название мероприятия: <span className='required-mark'>*</span></label>
            <div className='event-field-col'>
              <input
                className={`project-field-input ${error('title') ? 'input-error' : ''}`}
                value={form.title}
                maxLength={LIMITS.event.titleMax}
                onChange={e => update({ title: e.target.value })}
                onBlur={() => touch('title')}
              />
              {renderError('title')}
            </div>
          </div>

          <div className='project-field-row'>
            <label className='project-field-label'>Краткое описание: <span className='required-mark'>*</span></label>
            <div className='event-field-col'>
              <textarea
                className={`project-short-desc-editor ${error('shortDescription') ? 'input-error' : ''}`}
                value={form.shortDescription}
                maxLength={LIMITS.event.shortDescriptionMax}
                placeholder='Кратко опишите суть мероприятия в 1-2 предложениях'
                onChange={e => update({ shortDescription: e.target.value })}
                onBlur={() => touch('shortDescription')}
              />
              {renderError('shortDescription')}
            </div>
          </div>

          <div className='project-field-row'>
            <label className='project-field-label'>Статус:</label>
            <div className='project-select-wrapper' ref={statusMenuRef}>
              <div className={`project-select ${isStatusOpen ? 'active' : ''}`} onClick={() => setStatusOpen(!isStatusOpen)}>
                <p className='project-select-value'>{form.status}</p>
                <DropdownIcon className={`project-select-arrow ${isStatusOpen ? 'rotated' : ''}`} />
              </div>
              <Dropdown
                isOpen={isStatusOpen}
                items={statusOptions}
                onSelect={item => { update({ status: item.label }); setStatusOpen(false) }}
              />
            </div>
          </div>

          <div className='project-field-row'>
            <label className='project-field-label'>Приватность:</label>
            <div className='privacy-toggle-container'>
              <button className='privacy-toggle-btn' type='button' onClick={() => update({ isPrivate: !form.isPrivate })}>
                {form.isPrivate ? <PrivacyIcon className='lock-ico' /> : <PublicIcon className='lock-ico unlocked' />}
                <span>{form.isPrivate ? 'Приватный' : 'Публичный'}</span>
              </button>
              <p className='privacy-hint'>
                {form.isPrivate ? 'Только участники мероприятия могут видеть его' : 'Мероприятие видно всем пользователям'}
              </p>
            </div>
          </div>

          <div className='project-field-row top'>
            <label className='project-field-label'>Период проведения: <span className='required-mark'>*</span></label>
            <div className='event-field-col'>
              <div className='event-date-range'>
                <DatePicker
                  value={form.eventStart}
                  max={form.eventEnd || undefined}
                  hasError={!!error('event')}
                  onChange={eventStart => { update({ eventStart }); touch('event') }}
                />
                <DatePicker
                  align='right'
                  value={form.eventEnd}
                  min={form.eventStart || undefined}
                  hasError={!!error('event')}
                  onChange={eventEnd => { update({ eventEnd }); touch('event') }}
                />
              </div>
              {renderError('event')}
            </div>
          </div>

          <div className='project-field-row top'>
            <label className='project-field-label'>Туры / этапы:</label>
            <div className='event-field-col'>
              {form.stages.map(stage => {
                const message = stageError(stage.id)
                return (
                  <div key={stage.id} className='event-stage'>
                    <div className='event-stage-row'>
                      <input
                        className={`project-field-input event-stage-title ${message ? 'input-error' : ''}`}
                        placeholder='Название этапа'
                        value={stage.title}
                        maxLength={LIMITS.event.stageTitleMax}
                        onChange={e => updateStage(stage.id, { title: e.target.value })}
                      />
                      <DatePicker
                        value={stage.startDate}
                        min={form.eventStart || undefined}
                        max={stage.endDate || form.eventEnd || undefined}
                        hasError={!!message}
                        onChange={startDate => updateStage(stage.id, { startDate })}
                      />
                      <DatePicker
                        align='right'
                        value={stage.endDate}
                        min={stage.startDate || form.eventStart || undefined}
                        max={form.eventEnd || undefined}
                        hasError={!!message}
                        onChange={endDate => updateStage(stage.id, { endDate })}
                      />
                      <button type='button' className='member-remove-badge' onClick={() => removeStage(stage.id)}>
                        <Delete className='ico' />
                      </button>
                    </div>
                    <label className='event-checkbox'>
                      <input
                        type='checkbox'
                        checked={stage.acceptsApplications}
                        onChange={e => updateStage(stage.id, { acceptsApplications: e.target.checked })}
                      />
                      <span>Приём заявок</span>
                    </label>
                    {message && <p className='event-field-error'>{message}</p>}
                  </div>
                )
              })}

              <button
                type='button'
                className='event-add-stage-btn'
                onClick={addStage}
                disabled={form.stages.length >= LIMITS.event.stagesMax}
              >
                <Add className='event-add-stage-ico' />
                <span>Добавить этап</span>
              </button>
            </div>
          </div>

          <div className='project-field-row'>
            <label className='project-field-label'>Лимит участников:</label>
            <div className='event-field-col'>
              <div className='event-limit-row'>
                <input
                  className={`project-field-input event-limit-input ${error('limit') ? 'input-error' : ''}`}
                  inputMode='numeric'
                  value={form.limit}
                  disabled={form.noLimit}
                  onChange={e => update({ limit: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  onBlur={() => touch('limit')}
                />
                <label className='event-checkbox'>
                  <input
                    type='checkbox'
                    checked={form.noLimit}
                    onChange={e => { update({ noLimit: e.target.checked }); touch('limit') }}
                  />
                  <span>Нет лимита</span>
                </label>
              </div>
              {renderError('limit')}
            </div>
          </div>
        </div>
      </section>

      <section className='project-section'>
        <div className='section-header-wrapper'>
          <h2 className='project-section-title'>Описание мероприятия</h2>
          {descriptionChanged && <span className='draft-indicator'>(черновик)</span>}
          <span className={`event-char-counter ${descriptionTooLong ? 'limit' : ''}`}>
            {form.description.length} / {LIMITS.longTextMax}
          </span>
        </div>

        <EventMarkdownEditor
          eventId={event.eventId}
          section='description'
          value={form.description}
          onChange={description => update({ description })}
          hasError={descriptionTooLong}
          emptyPreviewText='Описание пока не заполнено'
          placeholder={'### О мероприятии\n\nРасскажите о целях, формате и правилах.\n\nИспользуйте **жирный текст**, списки и изображения (кнопка «Прикрепить медиа»).'}
        />
        {errors.description && <p className='event-field-error'>{errors.description}</p>}
      </section>

      <section className='project-section'>
        <h2 className='project-section-title'>Удаление</h2>
        <div className='warning-container'>
          <div className='warning-tittle-container'>
            <ImportantIcon className='svg-ico' />
            <p className='warning-tittle'>Удаление мероприятия</p>
          </div>
          <p className='warning-description'>Это действие необратимо. Мероприятие будет удалено навсегда со всеми данными.</p>
          <button className='warning-button' onClick={() => setShowDeleteForm(true)}>
            <Delete className='svg-ico' />
            Удалить мероприятие
          </button>
        </div>
      </section>

      <CommentsSection referenceType='event' referenceId={event.eventId} isOwner />

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
        successText='Мероприятие успешно обновлено'
        onSuccessEnd={() => setSaveSuccess(false)}
      />

      {showDeleteForm && (
        <DeleteEventForm
          eventId={event.eventId}
          onClose={() => setShowDeleteForm(false)}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </>
  )
}