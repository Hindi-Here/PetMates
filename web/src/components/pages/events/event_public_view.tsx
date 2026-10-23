import './event_public_view.scss'
import './event_form.scss'
import './event_description.scss'
import '../project.scss'
import '../project_public_view.scss'

import StarIcon from '@icons/star.svg?react'
import StatusEndIcon from '@icons/status_end.svg?react'
import StatusPauseIcon from '@icons/status_pause.svg?react'
import StatusWorkingIcon from '@icons/status_working.svg?react'
import BackIcon from '@icons/back.svg?react'
import RejectIcon from '@icons/reject.svg?react'

import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateModeration } from '../../scripts/query/invalidate'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

import { useAuth } from '../../hooks/useAuth'
import { useSystemRole } from '../../hooks/useSystemRole'
import { canModerateTarget } from '../../scripts/moderation'
import { queryKeys } from '../../scripts/query/queryKeys'
import { eventApi, type EventStage, type EventFormField, type EventDetails } from '../../services/event'
import DeleteEventModerationForm from '../../forms/delete_event_moderation'
import { EventTabs, PUBLIC_EVENT_TABS } from './event_tabs'
import { EventMembers } from './event_members'
import { EventApplicationForm } from './event_application_form'

export interface EventPublicData {
  eventId: string
  ownerId: string
  ownerSystemRole?: string
  title: string
  shortDescription: string
  status: string
  isPrivate: boolean
  ratingCount: number
  eventStartDate: string | null
  eventEndDate: string | null
  participantLimit: number | null
  stages: EventStage[]
  description: string
  applicationForm: EventFormField[]
  results: string
  registrationState: 'upcoming' | 'open' | 'closed'
  membersCount: number
}

export const toPublicData = (e: EventDetails): EventPublicData => ({
  eventId: e.eventId,
  ownerId: e.ownerId,
  ownerSystemRole: e.ownerSystemRole,
  title: e.title,
  shortDescription: e.shortDescription ?? '',
  status: e.status,
  isPrivate: e.isPrivate,
  ratingCount: e.ratingCount,
  eventStartDate: e.eventStartDate ?? null,
  eventEndDate: e.eventEndDate ?? null,
  participantLimit: e.participantLimit ?? null,
  stages: e.stages ?? [],
  description: e.description ?? '',
  applicationForm: e.applicationForm ?? [],
  results: e.results ?? '',
  registrationState: e.registrationState,
  membersCount: e.membersCount,
})

const getStatusConfig = (status: string) => {
  const configs: Record<string, {
    text: string
    className: string
    Icon: React.ComponentType<{ className?: string }>
  }> = {
    'В процессе': { text: 'В процессе', className: 'status-working', Icon: StatusWorkingIcon },
    'Завершён': { text: 'Завершён', className: 'status-end', Icon: StatusEndIcon },
    'Приостановлен': { text: 'Приостановлен', className: 'status-pause', Icon: StatusPauseIcon },
  }
  return configs[status] || configs['В процессе']
}

const formatDate = (value?: string | null) => {
  if (!value) return null
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

const periodText = (start?: string | null, end?: string | null) => {
  const s = formatDate(start)
  const e = formatDate(end)
  if (s && e) return s === e ? s : `${s} – ${e}`
  if (s) return `с ${s}`
  if (e) return `до ${e}`
  return 'Не указан'
}

interface EventPublicViewProps {
  data: EventPublicData
  activeTab: string
  basePath: string
  onBack: () => void
  isPreview?: boolean
  footer?: ReactNode
}

// Компонент для отображения публичного вида мероприятия
export const EventPublicView = ({
  data,
  activeTab,
  basePath,
  onBack,
  isPreview = false,
  footer,
}: EventPublicViewProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { userId } = useAuth()
  const currentSystemRole = useSystemRole()

  const [hasRated, setHasRated] = useState(false)
  const [isRatingLoading, setIsRatingLoading] = useState(false)
  const [showDeleteForm, setShowDeleteForm] = useState(false)

  const isOwner = userId === data.ownerId

  useEffect(() => {
    if (isPreview || !userId || isOwner) return
    eventApi.getUserRating(data.eventId)
      .then(r => setHasRated(r.hasRated))
      .catch(console.error)
  }, [data.eventId, userId, isOwner, isPreview])

  if (!PUBLIC_EVENT_TABS.some(t => t.id === activeTab)) {
    return <Navigate to={basePath} replace />
  }

  const statusConfig = getStatusConfig(data.status)
  const StatusIcon = statusConfig.Icon

  const canModerateDelete = !isPreview &&
    !isOwner &&
    !data.isPrivate &&
    canModerateTarget(currentSystemRole, data.ownerSystemRole)

  const handleRate = async () => {
    if (isPreview || !userId || isOwner || isRatingLoading) return
    setIsRatingLoading(true)
    try {
      const result = hasRated
        ? await eventApi.removeRating(data.eventId)
        : await eventApi.addRating(data.eventId)
      setHasRated(!hasRated)
      queryClient.setQueryData(queryKeys.events.byId(data.eventId), (old: EventDetails | undefined) =>
        old ? { ...old, ratingCount: result.ratingCount } : old
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.events.list() })
      if (userId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.events.favorites(userId) })
      }
    } catch (error) {
      console.error('Не удалось изменить оценку:', error)
    } finally {
      setIsRatingLoading(false)
    }
  }

  const tabPath = (id: string) => (id === 'info' ? basePath : `${basePath}/${id}`)

  const stages = data.stages.filter(s => s.title.trim() && s.startDate && s.endDate)
  const formFields = data.applicationForm.filter(f => f.label.trim())

    const renderInfo = () => (
    <>
      <section className='preview-section'>
        <div className='event-info-rows'>
          <div className='event-info-row'>
            <span className='event-info-label'>Период проведения</span>
            <span className='event-info-value'>{periodText(data.eventStartDate, data.eventEndDate)}</span>
          </div>
          <div className='event-info-row'>
            <span className='event-info-label'>Лимит участников</span>
            <span className='event-info-value'>{data.participantLimit ?? 'Без ограничений'}</span>
          </div>
        </div>
      </section>

      {stages.length > 0 && (
        <section className='preview-section'>
          <h3 className='preview-section-title'>Туры / этапы: <span className='count'>{stages.length}</span></h3>
          <div className='event-stages-list'>
            {stages.map((s, i) => (
              <div key={`${s.title}-${i}`} className='event-stage-item'>
                <span className='event-stage-name'>
                  {s.title}
                  {s.acceptsApplications && <span className='event-stage-badge'>Приём заявок</span>}
                </span>
                <span className='event-stage-dates'>{periodText(s.startDate, s.endDate)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.description ? (
        <section className='preview-section'>
          <div className='project-description-preview markdown-content'>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]} 
              rehypePlugins={[rehypeRaw]} 
              components={{ img: (props: any) => <img {...props} loading="lazy" decoding="async" /> }}
            >
              {data.description}
            </ReactMarkdown>
          </div>
        </section>
      ) : (
        <div className='empty-state'><p className='empty-text'>Описание пока не заполнено</p></div>
      )}
    </>
  )

    const renderForm = () => {
    if (!isPreview) return <EventApplicationForm data={data} />

    return (
      <section className='preview-section'>
        <h3 className='preview-section-title'>Форма заявки</h3>
        {formFields.length === 0 ? (
          <div className='event-form-empty'>
            В этом мероприятии нет формы заявки. Вы можете подать заявку, просто нажав «Отправить».
          </div>
        ) : (
          <div className='event-questions'>
            {formFields.map(field => (
              <div key={field.id} className='event-question'>
                <p className='event-question-label'>
                  {field.label}
                  {field.required && <span className='required-mark'> *</span>}
                </p>
                <textarea className='event-answer-input' disabled placeholder='Ваш ответ' />
              </div>
            ))}
          </div>
        )}
        <div className='event-submit-row'>
          <button className='event-submit-btn' disabled>Отправить</button>
          <p className='event-field-hint'>В режиме предпросмотра форма недоступна для заполнения</p>
        </div>
      </section>
    )
  }

  const renderResults = () =>
    data.results ? (
      <section className='preview-section'>
        <div className='project-description-preview markdown-content'>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {data.results}
          </ReactMarkdown>
        </div>
      </section>
    ) : (
      <div className='empty-state'><p className='empty-text'>Результаты пока не опубликованы</p></div>
    )

  return (
    <>
      <EventTabs tabs={PUBLIC_EVENT_TABS} active={activeTab} onSelect={id => navigate(tabPath(id))} />
      <div className='project-preview-header preview-mode'>
        <div className='project-info'>
          <h2 className='project-title'>О мероприятии {data.title}</h2>
          <div className={`project-status ${statusConfig.className}`}>
            <StatusIcon className='status-ico' />
            <span>{statusConfig.text}</span>
          </div>
        </div>
        <div className='project-actions'>
          <div className='rate-column'>
            <button
              className={`rate-button ${hasRated ? 'rated' : ''}`}
              onClick={handleRate}
              disabled={isPreview || !userId || isOwner || isRatingLoading}
            >
              {hasRated ? 'Оценено' : 'Оценить'}
            </button>
            <div className='project-rating'>
              <StarIcon className='star-ico small' />
              <span>{data.ratingCount || 0} оценок</span>
            </div>
          </div>
          <button className='back-button' onClick={onBack} disabled={isPreview}>
            <BackIcon className='ico' />
          </button>
          {canModerateDelete && (
            <button className='moderation-delete-project-btn' onClick={() => setShowDeleteForm(true)}>
              <RejectIcon className='ico' />
            </button>
          )}
        </div>
      </div>

      {activeTab === 'info' && renderInfo()}
      {activeTab === 'form' && renderForm()}
      {activeTab === 'members' && (
        <EventMembers eventId={data.eventId} participantLimit={data.participantLimit} />
      )}
      {activeTab === 'results' && renderResults()}

      {footer}

      {showDeleteForm && (
        <DeleteEventModerationForm
          eventId={data.eventId}
          eventTitle={data.title}
          onClose={() => setShowDeleteForm(false)}
          onSuccess={async () => {
            await invalidateModeration(queryClient)
            onBack()
          }}
        />
      )}
    </>
  )
}