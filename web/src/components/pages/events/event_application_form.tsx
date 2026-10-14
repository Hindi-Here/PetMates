import '../project.scss'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys } from '../../scripts/query/queryKeys'
import { eventApi, type MyApplication } from '../../services/event'
import type { EventPublicData } from './event_public_view'
import './event_applications.scss'

const MAX_ANSWER = 2000

const BANNER_TEXT: Record<MyApplication['status'], string> = {
  pending: 'Заявка отправлена и ожидает решения организатора',
  revision: 'Организатор просит доработать заявку',
  accepted: 'Заявка принята: вы участник мероприятия',
  rejected: 'Заявка отклонена. Вы можете исправить ответы и отправить её повторно',
}

// Компонент для отображения формы заявки на участие в мероприятии, с возможностью заполнения, отправки и отзыва заявки
export const EventApplicationForm = ({ data }: { data: EventPublicData }) => {
  const queryClient = useQueryClient()
  const { userId } = useAuth()
  const myKey = queryKeys.events.myApplication(data.eventId)

  const fields = useMemo(() => data.applicationForm.filter(f => f.label.trim()), [data.applicationForm])

  const { data: mine, isLoading } = useQuery({
    queryKey: myKey,
    queryFn: () => eventApi.getMyApplication(data.eventId),
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const [values, setValues] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mine) return
    const next: Record<string, string> = {}
    mine.answers.forEach(a => { next[a.fieldId] = a.value })
    setValues(next)
  }, [mine])

  const limitReached = data.participantLimit !== null && data.membersCount >= data.participantLimit
  const editableStatus = mine?.status === 'revision'
    || (mine?.status === 'rejected' && data.registrationState === 'open' && !limitReached)
  const canFill = !!userId && !isLoading && (
    mine ? editableStatus : data.registrationState === 'open' && !limitReached
  )

  const showSubmit = !mine || mine.status === 'revision' || mine.status === 'rejected'

  const errors: Record<string, string> = {}
  fields.forEach(f => {
    if (f.required && !(values[f.id] ?? '').trim()) errors[f.id] = 'Обязательное поле'
  })
  const isValid = Object.keys(errors).length === 0

  const saveMutation = useMutation({
    mutationFn: () => {
      const answers = fields.map(f => ({ fieldId: f.id, value: (values[f.id] ?? '').trim() }))
      return mine
        ? eventApi.resubmitApplication(data.eventId, answers)
        : eventApi.submitApplication(data.eventId, answers)
    },
    onSuccess: saved => {
      queryClient.setQueryData(myKey, saved)
      setError(null)
      setTouched({})
    },
    onError: (e: Error) => setError(e.message),
  })

  const withdrawMutation = useMutation({
    mutationFn: () => eventApi.withdrawApplication(data.eventId),
    onSuccess: () => {
      queryClient.setQueryData(myKey, null)
      setValues({})
      setTouched({})
      setError(null)
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleWithdraw = () => {
    if (!window.confirm('Отозвать заявку?')) return
    withdrawMutation.mutate()
  }

  let hint: string | null = null
  if (!userId) hint = 'Войдите в аккаунт, чтобы подать заявку'
  else if (!mine && data.registrationState === 'upcoming') hint = 'Приём заявок ещё не начался'
  else if (!mine && data.registrationState === 'closed') hint = 'Приём заявок завершён'
  else if (!mine && limitReached) hint = 'Достигнут лимит участников'

  const busy = saveMutation.isPending || withdrawMutation.isPending

  return (
    <section className='preview-section'>
      <h3 className='preview-section-title'>Форма заявки</h3>

      {mine && (
        <div className={`event-app-banner ${mine.status}`}>
          <p className='event-app-banner-title'>{BANNER_TEXT[mine.status]}</p>
          {mine.decisionComment && <p className='event-app-banner-text'>{mine.decisionComment}</p>}
        </div>
      )}

      {fields.length === 0 ? (
        <div className='event-form-empty'>
          В этом мероприятии нет формы заявки. Вы можете подать заявку, просто нажав «Отправить».
        </div>
      ) : (
        <div className='event-questions'>
          {fields.map(field => {
            const fieldError = touched[field.id] ? errors[field.id] : undefined
            return (
              <div key={field.id} className='event-question'>
                <p className='event-question-label'>
                  {field.label}
                  {field.required && <span className='required-mark'> *</span>}
                </p>
                <textarea
                  className={`event-answer-input ${fieldError ? 'input-error' : ''}`}
                  value={values[field.id] ?? ''}
                  maxLength={MAX_ANSWER}
                  disabled={!canFill || busy}
                  placeholder='Ваш ответ'
                  onChange={e => { setValues(prev => ({ ...prev, [field.id]: e.target.value })); setTouched(prev => ({ ...prev, [field.id]: true })) }}
                  onBlur={() => setTouched(prev => ({ ...prev, [field.id]: true }))}
                />
                {fieldError && <p className='event-field-error'>{fieldError}</p>}
              </div>
            )
          })}
        </div>
      )}

      <div className='event-submit-row'>
        {showSubmit && (
          <button
            className='event-submit-btn'
            onClick={() => saveMutation.mutate()}
            disabled={!canFill || !isValid || busy}
          >
            {mine ? 'Отправить повторно' : 'Отправить'}
          </button>
        )}
        {mine && mine.status !== 'accepted' && (
          <button className='event-withdraw-btn' onClick={handleWithdraw} disabled={busy}>
            Отозвать заявку
          </button>
        )}
        {hint && <p className='event-field-hint'>{hint}</p>}
      </div>

      {error && <p className='event-field-error'>{error}</p>}
    </section>
  )
}