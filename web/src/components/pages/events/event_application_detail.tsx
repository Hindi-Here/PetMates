import '../project.scss'
import BackIcon from '@icons/back.svg?react'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../scripts/query/queryKeys'
import { eventApi, type ApplicationDecision } from '../../services/event'
import { ApplicationStatusBadge } from './event_application_status'

import { LIMITS } from '../../scripts/limits'

interface EventApplicationDetailProps {
  eventId: string
  applicationId: string
  basePath: string
}

// Компонент для отображения деталей заявки на участие в мероприятии, включая информацию о заявителе, ответы на вопросы и возможность принять или отклонить заявку
export const EventApplicationDetail = ({ eventId, applicationId, basePath }: EventApplicationDetailProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listPath = `${basePath}/applications`
  const detailKey = queryKeys.events.application(eventId, applicationId)

  const [mode, setMode] = useState<'revision' | 'reject' | null>(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: app, isLoading } = useQuery({
    queryKey: detailKey,
    queryFn: () => eventApi.getApplication(eventId, applicationId),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
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

  if (isLoading) return <div className='loading-container' />

  if (!app) {
    return (
      <div className='empty-state'>
        <p className='empty-text'>Заявка не найдена</p>
      </div>
    )
  }

  const applicant = app.applicant
  const meta = [applicant.realName, applicant.age && `${applicant.age} лет`, applicant.city].filter(Boolean)
  const canDecide = app.status === 'pending' || app.status === 'revision'
  const limitReached = app.participantLimit !== null && app.membersCount >= app.participantLimit
  const banned = applicant.isBanned === true
  const canAccept = canDecide && !limitReached && !banned

  const handleAccept = () => {
    if (!canAccept || decideMutation.isPending) return
    if (!window.confirm('Принять заявку? Пользователь станет участником мероприятия.')) return
    decideMutation.mutate({ decision: 'accept' })
  }

  const handleConfirm = () => {
    if (!mode || decideMutation.isPending) return
    decideMutation.mutate({ decision: mode, comment: comment.trim() })
  }

  const created = new Date(app.createdAt)

  return (
    <>
      <section className='project-section'>
        <div className='event-app-detail-head'>
          <button className='event-app-back' onClick={() => navigate(listPath)}>
            <BackIcon className='ico' />
          </button>
          <h2 className='project-section-title'>Заявка на участие</h2>
          <ApplicationStatusBadge status={app.status} />
        </div>

        <div className='event-app-applicant-card'>
          <img src={applicant.avatarUrl || '/default-avatar.png'} alt={applicant.nickname} />
          <div className='event-app-applicant-card-info'>
            <p className='event-app-applicant-name'>@{applicant.nickname}</p>
            {meta.length > 0 && <p className='event-app-applicant-meta'>{meta.join(' • ')}</p>}
            <p className='event-app-applicant-role'>{applicant.profileRole || 'Роль не указана'}</p>
          </div>
          <button className='event-app-profile-btn' onClick={() => navigate(`/profile/${applicant.userId}/info`)}>
            Открыть профиль
          </button>
        </div>

        <p className='event-field-hint'>
          Подана {created.toLocaleDateString('ru-RU')}, {created.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          {app.updatedAt !== app.createdAt && ` • доработана ${new Date(app.updatedAt).toLocaleDateString('ru-RU')}`}
        </p>
      </section>

      <section className='project-section'>
        <h2 className='project-section-title'>Ответы</h2>
        <div className='event-app-answers'>
          {app.answers.length === 0 && (
            <p className='event-field-hint'>В форме не было вопросов: заявка подана без ответов</p>
          )}
          {app.answers.map(answer => (
            <div key={answer.fieldId} className='event-app-answer'>
              <p className='event-app-answer-label'>
                {answer.label}
                {answer.required && <span className='required-mark'> *</span>}
              </p>
              <p className={`event-app-answer-value ${answer.value ? '' : 'empty'}`}>
                {answer.value || 'Не заполнено'}
              </p>
            </div>
          ))}
        </div>
      </section>

      {app.decisionComment && (
        <section className='project-section'>
          <div className={`event-app-banner ${app.status}`}>
            <p className='event-app-banner-title'>
              {app.status === 'revision' ? 'Комментарий для доработки' : 'Комментарий к решению'}
            </p>
            <p className='event-app-banner-text'>{app.decisionComment}</p>
          </div>
        </section>
      )}

      <section className='project-section'>
        <h2 className='project-section-title'>Решение</h2>

        {canDecide ? (
          <div className='event-decision-panel'>
            <p className='event-field-hint'>
              Участников: {app.membersCount}{app.participantLimit ? ` / ${app.participantLimit}` : ''}
              {limitReached && ' — лимит исчерпан, принять заявку нельзя'}
              {banned && ' — пользователь заблокирован, принять заявку нельзя'}
            </p>

            <div className='event-decision-actions'>
              <button className='event-decision-btn accept' onClick={handleAccept} disabled={!canAccept || decideMutation.isPending}>
                Принять
              </button>
              <button
                className={`event-decision-btn neutral ${mode === 'revision' ? 'active' : ''}`}
                onClick={() => { setMode(mode === 'revision' ? null : 'revision'); setComment('') }}
                disabled={decideMutation.isPending}
              >
                На доработку
              </button>
              <button
                className={`event-decision-btn danger ${mode === 'reject' ? 'active' : ''}`}
                onClick={() => { setMode(mode === 'reject' ? null : 'reject'); setComment('') }}
                disabled={decideMutation.isPending}
              >
                Отклонить
              </button>
            </div>

            {mode && (
              <div className='event-decision-comment'>
                <textarea
                  className='event-answer-input'
                  value={comment}
                  maxLength={LIMITS.event.decisionCommentMax}
                  placeholder={mode === 'revision' ? 'Что нужно доработать (обязательно)' : 'Причина отказа (необязательно)'}
                  onChange={e => setComment(e.target.value)}
                />
                <div className='event-decision-confirm'>
                  <button
                    className={`event-decision-btn ${mode === 'reject' ? 'danger active' : 'neutral active'}`}
                    onClick={handleConfirm}
                    disabled={decideMutation.isPending || (mode === 'revision' && !comment.trim())}
                  >
                    {mode === 'revision' ? 'Отправить на доработку' : 'Подтвердить отказ'}
                  </button>
                  <button className='event-decision-btn neutral' onClick={() => { setMode(null); setComment('') }}>
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {error && <p className='event-field-error'>{error}</p>}
          </div>
        ) : (
          <div className='event-decision-panel'>
            <p className='event-field-hint'>
              {app.status === 'accepted'
                ? 'Заявка принята. Пользователь добавлен в участников мероприятия.'
                : 'Заявка отклонена. Пользователь может исправить её и отправить повторно.'}
            </p>
            {app.status === 'accepted' && (
              <div className='event-decision-actions'>
                <button className='event-decision-btn neutral' onClick={() => navigate(`${basePath}/members`)}>
                  К участникам
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  )
}