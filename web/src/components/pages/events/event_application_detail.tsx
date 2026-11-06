import './event_application_detail.scss'
import BackIcon from '@icons/back.svg?react'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../scripts/query/queryKeys'
import { eventApi, type ApplicationDecision } from '../../services/event'
import { ApplicationStatusBadge } from './event_application_status'
import { UserCard } from '../../common/userCard'

import { LIMITS } from '../../scripts/limits'
import { STALE } from '@/components/scripts/query/queryClient'

interface EventApplicationDetailProps {
  eventId: string
  applicationId: string
  basePath: string
}

export const EventApplicationDetail = ({ eventId, applicationId, basePath }: EventApplicationDetailProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listPath = `${basePath}/applications`
  const detailKey = queryKeys.events.application(eventId, applicationId)

  const [mode, setMode] = useState<'revision' | 'reject' | null>(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  const [confirmRemove, setConfirmRemove] = useState(false)

  const { data: app, isLoading } = useQuery({
    queryKey: detailKey,
    queryFn: () => eventApi.getApplication(eventId, applicationId),
    retry: false,
    staleTime: STALE.none,
  })

  const decideMutation = useMutation({
    mutationFn: (v: { decision: ApplicationDecision; comment?: string }) =>
      eventApi.decideApplication(eventId, applicationId, v.decision, v.comment),
    onSuccess: saved => {
      queryClient.setQueryData(detailKey, saved)
      queryClient.invalidateQueries({ queryKey: queryKeys.events.applications(eventId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.events.members(eventId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.events.byId(eventId) })
      setMode(null)
      setComment('')
      setError(null)
    },
    onError: (e: Error) => setError(e.message),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => eventApi.removeMember(eventId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: detailKey })
      queryClient.invalidateQueries({ queryKey: queryKeys.events.applications(eventId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.events.members(eventId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.events.byId(eventId) })
      setConfirmRemove(false)
      setError(null)
      navigate(listPath)
    },
    onError: (e: Error) => setError(e.message),
  })

  if (isLoading) return <div className='loading-container' />

  if (!app) {
    return (
      <div className='empty-state'>
        <p className='empty-text'>Заявка не найдена</p>
      </div>
    )
  }

  const applicant = app.applicant
  const canDecide = app.status === 'pending' || app.status === 'revision'
  const limitReached = app.participantLimit !== null && app.membersCount >= app.participantLimit
  const banned = applicant.isBanned === true
  const canAccept = canDecide && !limitReached && !banned

  const handleAccept = () => {
    if (!canAccept || decideMutation.isPending) return
    decideMutation.mutate({ decision: 'accept' })
  }

  const handleConfirm = () => {
    if (!mode || decideMutation.isPending) return
    decideMutation.mutate({ decision: mode, comment: comment.trim() })
  }

  const handleRemove = () => {
    if (removeMutation.isPending) return
    removeMutation.mutate(applicant.userId)
  }

  const created = new Date(app.createdAt)

  return (
    <div className='application-detail-page'>
      <div className='application-header'>
        <div className='header-left'>
          <button className='back-button' onClick={() => navigate(listPath)}>
            <BackIcon className='ico' />
          </button>
          <div className='title-wrapper'>
            <h2 className='page-title'>Заявка на участие</h2>
            <span className='submitted-date'>
              Подана {created.toLocaleDateString('ru-RU')}, {created.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <ApplicationStatusBadge status={app.status} />
      </div>

      <UserCard
        user={applicant}
        disabledInvite={true}
        showModerationMenu={false}
        role={applicant.profileRole || undefined}
      />

      <section className='form-section'>
        <h3 className='section-title'>Форма</h3>
        <div className='answers-list'>
          {app.answers.length === 0 && (
            <p className='status-hint'>В форме не было вопросов: заявка подана без ответов</p>
          )}
          {app.answers.map(answer => (
            <div key={answer.fieldId} className='answer-item'>
              <p className='answer-label'>
                {answer.label}
                {answer.required && <span className='required-mark'> *</span>}
              </p>
              <p className={`answer-value ${answer.value ? '' : 'empty'}`}>
                {answer.value || 'Не заполнено'}
              </p>
            </div>
          ))}
        </div>
      </section>

      {app.decisionComment && (
        <section className='form-section'>
          <div className={`event-app-banner ${app.status}`}>
            <p className='event-app-banner-title'>
              {app.status === 'revision' ? 'Комментарий для доработки' : 'Комментарий к решению'}
            </p>
            <p className='event-app-banner-text'>{app.decisionComment}</p>
          </div>
        </section>
      )}

      {canDecide && (
        <section className='decision-section'>
          <h3 className='section-title'>Решение</h3>
          
          {error && <p className='error-message'>{error}</p>}

          <div className='decision-buttons'>
            <button className='decision-btn accept' onClick={handleAccept} disabled={!canAccept || decideMutation.isPending}>
              Принять
            </button>
            <button
              className={`decision-btn revision ${mode === 'revision' ? 'active' : ''}`}
              onClick={() => { setMode(mode === 'revision' ? null : 'revision'); setComment('') }}
              disabled={decideMutation.isPending}
            >
              На доработку
            </button>
            <button
              className='decision-btn reject'
              onClick={() => decideMutation.mutate({ decision: 'reject', comment: '' })}
              disabled={decideMutation.isPending}
            >
              Отклонить
            </button>
          </div>

          {mode === 'revision' && (
            <div className='comment-area'>
              <textarea
                className='comment-textarea'
                value={comment}
                maxLength={LIMITS.event.decisionCommentMax}
                placeholder='Что нужно доработать (обязательно)'
                onChange={e => setComment(e.target.value)}
              />
              <div className='comment-actions'>
                <button
                  className='comment-btn confirm'
                  onClick={handleConfirm}
                  disabled={decideMutation.isPending || !comment.trim()}
                >
                  Отправить на доработку
                </button>
                <button className='comment-btn cancel' onClick={() => { setMode(null); setComment('') }}>
                  Отмена
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {!canDecide && (
        <section className='decision-section'>
          <h3 className='section-title'>Решение</h3>
          <p className='status-hint'>
            {app.status === 'accepted'
              ? 'Заявка принята. Пользователь добавлен в участников мероприятия.'
              : 'Заявка отклонена. Пользователь может исправить её и отправить повторно.'}
          </p>
          
          {error && <p className='error-message'>{error}</p>}

          {app.status === 'accepted' && (
            <>
              {confirmRemove && (
                <p className='status-hint' style={{ color: 'var(--important-color)', marginTop: 'rem(8)' }}>
                  Исключить <strong>@{applicant.nickname}</strong> из участников? Пользователь получит уведомление и сможет подать заявку заново.
                </p>
              )}
              <div className='decision-buttons' style={{ marginTop: 'rem(8)' }}>
                {confirmRemove ? (
                  <>
                    <button className='decision-btn red' onClick={handleRemove} disabled={removeMutation.isPending}>
                      {removeMutation.isPending ? 'Удаление...' : 'Подтвердить'}
                    </button>
                    <button className='decision-btn cancellation' onClick={() => setConfirmRemove(false)} disabled={removeMutation.isPending}>
                      Отмена
                    </button>
                  </>
                ) : (
                  <>
                    <button className='decision-btn red' onClick={() => setConfirmRemove(true)}>
                      Удалить из мероприятия
                    </button>
                    <button className='decision-btn cancellation' onClick={() => navigate(`${basePath}/members`)}>
                      К участникам
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}