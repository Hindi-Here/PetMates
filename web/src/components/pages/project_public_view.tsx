import './project_public_view.scss'

import StarIcon from '@icons/star.svg?react'
import StatusEndIcon from '@icons/status_end.svg?react'
import StatusPauseIcon from '@icons/status_pause.svg?react'
import StatusWorkingIcon from '@icons/status_working.svg?react'
import RejectIcon from '@icons/reject.svg?react'
import BackIcon from '@icons/back.svg?react'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useAuth } from '../hooks/useAuth'
import { useSystemRole } from '../hooks/useSystemRole'
import { canModerateTarget } from '../scripts/moderation'
import { queryKeys } from '../scripts/query/queryKeys'
import { invalidateModeration } from '../scripts/query/invalidate'
import { projectsApi, type ProjectData } from '../services/project'
import type { UserData } from '../services/users'
import type { VacancyData } from '../services/vacancy'
import { VacancyCard } from '../common/vacancyCard'
import { UserCard } from '../common/userCard'
import { CommentsSection } from '../common/commentsSection'
import DeleteProjectModerationForm from '../forms/delete_project_moderation'
import { Markdown } from '../common/markdown'
import { projectMembersApi } from '../services/project_members'

export interface TeamMemberWithUser {
  memberId: string
  projectId: string
  userId: string
  role: string
  joinedAt?: string
  userData?: UserData
  isOwner?: boolean
}

export interface ProjectPublicData {
  projectId: string
  ownerId: string
  ownerSystemRole?: string
  title: string
  status: string
  description: string
  isPrivate: boolean
  ratingCount: number
}

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

interface ProjectPublicViewProps {
  data: ProjectPublicData
  team: TeamMemberWithUser[]
  vacancies: VacancyData[]
  onBack: () => void
  isPreview?: boolean
}

// Компонент для отображения публичного вида проекта
export const ProjectPublicView = ({ data, team, vacancies, onBack, isPreview = false }: ProjectPublicViewProps) => {
  const queryClient = useQueryClient()
  const { userId } = useAuth()
  const currentSystemRole = useSystemRole()

  const [hasRated, setHasRated] = useState(false)
  const [isRatingLoading, setIsRatingLoading] = useState(false)
  const [showDeleteForm, setShowDeleteForm] = useState(false)

  const isOwner = !!userId && userId === data.ownerId
  const members = team.filter(m => !!m.userData)

  const myMembership = team.find(m => m.userId === userId && !m.isOwner)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const handleLeave = async () => {
    if (!myMembership)
      return
    try {
      await projectMembersApi.leave(myMembership.memberId)
      await invalidateModeration(queryClient)
      onBack()
    } catch (e) {
      setLeaveError(e instanceof Error ? e.message : 'Не удалось покинуть проект')
      setTimeout(() => setLeaveError(null), 3000)
    }
  }

  useEffect(() => {
    if (isPreview || !userId || isOwner) return
    projectsApi.getUserRating(data.projectId)
      .then(r => setHasRated(r.hasRated))
      .catch(error => console.error('Failed to load rating status:', error))
  }, [data.projectId, userId, isOwner, isPreview])

  useEffect(() => {
    if (isPreview) return
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) return
      if (document.querySelector('.dark-area-container')) return
      window.history.back()
    }
    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [isPreview])

  const statusConfig = getStatusConfig(data.status)
  const StatusIcon = statusConfig.Icon

  const canModerateDelete = !isPreview &&
    !data.isPrivate &&
    canModerateTarget(currentSystemRole, data.ownerSystemRole)

  const handleRate = async () => {
    if (isPreview || !userId || isOwner || isRatingLoading) return
    setIsRatingLoading(true)
    try {
      const result = await projectsApi.toggleRating(data.projectId, hasRated)
      setHasRated(result.hasRated)
      queryClient.setQueryData(queryKeys.projects.byId(data.projectId), (old: ProjectData | undefined) =>
        old ? { ...old, ratingCount: result.ratingCount } : old
      )

      queryClient.invalidateQueries({ queryKey: queryKeys.vacancies.all })
      if (userId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.favorites(userId) })
      }
    } catch (error) {
      console.error('Failed to toggle rating:', error)
    } finally {
      setIsRatingLoading(false)
    }
  }

  return (
    <>
      <div className='project-preview-header preview-mode'>
        <div className='project-info'>
          <h2 className='project-title'>О проекте {data.title}</h2>
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
              disabled={isPreview || isOwner || !userId || isRatingLoading}
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
          {!isPreview && myMembership && (
            <button className='rate-button' onClick={handleLeave}>Покинуть</button>
          )}
          {canModerateDelete && (
            <button className='moderation-delete-project-btn' onClick={() => setShowDeleteForm(true)}>
              <RejectIcon className='ico' />
            </button>
          )}
        </div>
      </div>

      {data.description ? (
        <section className='preview-section'>
          <div className='project-description-preview markdown-content'>
            <Markdown>{data.description}</Markdown>
          </div>
        </section>
      ) : (
        <div className='empty-state'><p className='empty-text'>Проект пока не заполнен</p></div>
      )}

      {members.length > 0 && (
        <section className='preview-section'>
          <h3 className='preview-section-title'>Команда: <span className='count'>{members.length}</span></h3>
          <div className='team-list-preview'>
            {members.map(member => (
              <UserCard
                key={member.memberId}
                user={member.userData!}
                isOwner={member.isOwner}
                role={member.role}
                disabledInvite={true}
                showModerationMenu={!isPreview}
              />
            ))}
          </div>
        </section>
      )}

      {vacancies.length > 0 && (
        <section className='preview-section'>
          <h3 className='preview-section-title'>Заявки: <span className='count'>{vacancies.length}</span></h3>
          <div className='vacancy-list-preview'>
            {vacancies.map(vacancy => (
              <VacancyCard
                key={vacancy.vacancyId}
                vacancy={vacancy}
                clickable={false}
                showModerationDelete={canModerateDelete}
              />
            ))}
          </div>
        </section>
      )}

      <CommentsSection
        referenceType='project'
        referenceId={data.projectId}
        readOnly={isPreview}
        canDeleteComment={comment => canModerateTarget(currentSystemRole, comment.authorSystemRole)}
      />

      {showDeleteForm && (
        <DeleteProjectModerationForm
          projectId={data.projectId}
          projectTitle={data.title}
          onClose={() => setShowDeleteForm(false)}
          onSuccess={async () => {
            await invalidateModeration(queryClient)
            onBack()
          }}
        />
      )}
      {leaveError && <p className='field-error-text'>{leaveError}</p>}
    </>
  )
}