import '../pages/activity.scss'

import StarIcon from '@icons/star.svg?react'
import UsersIcon from '@icons/users.svg?react'
import CalendarIcon from '@icons/calendar.svg?react'
import StatusEndIcon from '@icons/status_end.svg?react'
import StatusPauseIcon from '@icons/status_pause.svg?react'
import StatusWorkingIcon from '@icons/status_working.svg?react'
import LockIcon from '@icons/lock.svg?react'
import RejectIcon from '@icons/reject.svg?react'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useSystemRole } from '../hooks/useSystemRole'
import { canModerateTarget } from '../scripts/moderation'
import { queryKeys } from '../scripts/query/queryKeys'
import type { EventData } from '../services/event'
import DeleteEventModerationForm from '../forms/delete_event_moderation'

const getStatusConfig = (status: string) => {
  const configs: Record<string, {
    text: string
    className: string
    Icon: React.ComponentType<{ className?: string }>
  }> = {
    'В процессе': { text: 'В процессе', className: 'status-in-progress', Icon: StatusWorkingIcon },
    'Завершён': { text: 'Завершён', className: 'status-completed', Icon: StatusEndIcon },
    'Приостановлен': { text: 'Приостановлен', className: 'status-paused', Icon: StatusPauseIcon },
  }
  return configs[status] || configs['В процессе']
}

const formatIsoDate = (value?: string | null) => {
  if (!value) return null
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

const getEventDatesText = (start?: string | null, end?: string | null) => {
  const s = formatIsoDate(start)
  const e = formatIsoDate(end)
  if (s && e) return s === e ? s : `${s} – ${e}`
  if (s) return `с ${s}`
  if (e) return `до ${e}`
  return 'Дата не указана'
}

interface EventCardProps {
  event: EventData
  showModerationDelete?: boolean
}

export const EventCard = ({ event, showModerationDelete = false }: EventCardProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentSystemRole = useSystemRole()
  const [showDeleteForm, setShowDeleteForm] = useState(false)

  const statusConfig = getStatusConfig(event.status)
  const StatusIcon = statusConfig.Icon

  const canModerate = showModerationDelete &&
    !event.isPrivate &&
    canModerateTarget(currentSystemRole, event.ownerSystemRole)

  return (
    <>
      <div
        className={`project-card 
          ${canModerate ? 'with-moderation' : ''} 
          ${event.ownerIsBanned ? 'banned-owner-card' : ''}`}
        onClick={() => navigate(`/profile/${event.ownerId}/activity/event/${event.eventId}`)}
      >
        {canModerate && (
          <button
            className='project-moderation-delete-btn'
            onClick={e => { e.stopPropagation(); setShowDeleteForm(true) }}
          >
            <RejectIcon className='ico' />
          </button>
        )}

        <div className="project-card-header">
          <h3 className="project-card-title">
            {event.title}
            {event.isPrivate && <LockIcon className="private-icon" />}
          </h3>
          <span className={`project-card-status ${statusConfig.className}`}>
            <StatusIcon className="status-icon" />
            {statusConfig.text}
          </span>
        </div>

        {event.shortDescription && (
          <p className="project-card-description">{event.shortDescription}</p>
        )}

        <p className="project-card-dates">
          <CalendarIcon className="meta-icon" />
          <span>Дата проведения: {getEventDatesText(event.eventStartDate, event.eventEndDate)}</span>
        </p>

        <div className="project-card-footer">
          <div className="project-card-meta">
            <span className="meta-item">
              <UsersIcon className="meta-icon" />
              {event.membersCount || 0} участников
            </span>
            <span className="meta-item">
              <StarIcon className="meta-icon" />
              {event.ratingCount} оценок
            </span>
          </div>

          {event.createdAt && (
            <span className="project-card-date">
              <CalendarIcon className="meta-icon" />
              {new Date(event.createdAt).toLocaleDateString('ru-RU')}
            </span>
          )}
        </div>
      </div>

      {showDeleteForm && (
        <DeleteEventModerationForm
          eventId={event.eventId}
          eventTitle={event.title}
          onClose={() => setShowDeleteForm(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: queryKeys.events.all })}
        />
      )}
    </>
  )
}