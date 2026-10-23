import './vacancyCard.scss'

import CalendarIcon from '@icons/calendar.svg?react'
import StarIcon from '@icons/star.svg?react'
import RejectIcon from '@icons/reject.svg?react'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSystemRole } from '../hooks/useSystemRole'
import { useUser } from '../hooks/useUser'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { canModerateTarget } from '../scripts/moderation'
import { projectsApi } from '../services/project'
import { projectMembersApi } from '../services/project_members'
import { responseApi } from '../services/response'
import { notificationApi } from '../services/notification'
import type { VacancyData } from '../services/vacancy'
import type { ProjectMemberData } from '../services/project_members'
import DeleteVacancyModerationForm from '../forms/delete_vacancy_moderation'
import { STALE } from '../scripts/query/queryClient'

type NotificationContextData = Record<string, string | number | boolean | null | undefined>

// Функция для отправки уведомлений пользователю
const sendNotification = (
  userId: string,
  referenceType: string,
  referenceId: string,
  eventType: string,
  contextData: NotificationContextData
) => {
  notificationApi.create({
    userId,
    referenceType,
    referenceId,
    contextData: { ...contextData, eventType },
  }).catch(err => console.error('Ошибка создания уведомления:', err))
}

// Компонент карточки вакансии (информация, логика, модерация)
export const VacancyCard = ({ 
  vacancy,
  showModerationDelete = true,
  clickable = true
}: { 
  vacancy: VacancyData
  showModerationDelete?: boolean
  clickable?: boolean
}) => {
  const navigate = useNavigate()
  const { userId, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const currentSystemRole = useSystemRole()
  
  const [showDeleteForm, setShowDeleteForm] = useState(false)

  const { data: project } = useQuery({
    queryKey: queryKeys.projects.byId(vacancy.projectId!),
    queryFn: () => projectsApi.getProject(vacancy.projectId!),
    enabled: !!vacancy.projectId,
    staleTime: STALE.long,
  })
  const projectOwnerId = project?.ownerId ?? null

  const { data: owner } = useUser(projectOwnerId)
  const { data: me } = useUser(userId)

  const projectOwnerRole = owner?.systemRole ?? 'user'
  const ownerIsBanned = owner?.isBanned ?? false
  const currentUserNickname = me?.nickname ?? null
  const isOwner = !!userId && projectOwnerId === userId 

  const { data: projectMembers = [] } = useQuery<ProjectMemberData[]>({
    queryKey: queryKeys.projects.members(vacancy.projectId!),
    queryFn: () => projectMembersApi.getByProject(vacancy.projectId!),
    enabled: !!vacancy.projectId && !!userId,
    staleTime: STALE.medium,
  })
  const isTeamMember = projectMembers.some((member: ProjectMemberData) => member.userId === userId)

  const { data: outgoing = [] } = useQuery({
    queryKey: queryKeys.responses.outgoing(userId!),
    queryFn: () => responseApi.getOutgoing(userId!),
    enabled: !!userId,
    staleTime: STALE.short,
  })
  const hasResponded = outgoing.some((r: any) => r.vacancyId === vacancy.vacancyId)

  const canModerate = showModerationDelete && !isOwner && (
    currentSystemRole === 'admin' || 
    (projectOwnerRole !== null && canModerateTarget(currentSystemRole, projectOwnerRole))
  )

  const handleModerationDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteForm(true) 
  }

  const applyMutation = useMutation({
    mutationFn: () => responseApi.create({ 
      userId: userId!, 
      vacancyId: vacancy.vacancyId, 
      status: 'pending' 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.responses.outgoing(userId!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.responses.all })
      
      if (userId) {
        sendNotification(userId, 'response', vacancy.projectId!, 'response_sent', {
          projectName: vacancy.projectTitle || 'Проект',
          vacancyName: vacancy.title || 'Заявка',
        })
      }
      
      if (projectOwnerId && userId) {
        sendNotification(projectOwnerId, 'response', vacancy.projectId!, 'response_received', {
          projectName: vacancy.projectTitle || 'Проект',
          vacancyName: vacancy.title || 'Заявка',
          nickname: currentUserNickname || 'Пользователь',
        })
      }
      
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications.all,
        refetchType: 'active'
      })
    },
  })

  const handleApply = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasResponded || isOwner || !userId || ownerIsBanned || isTeamMember) return
    applyMutation.mutate()
  }

  const handleCardClick = () => {
    if (!clickable || !projectOwnerId) return
    navigate(`/profile/${projectOwnerId}/activity/project/${vacancy.projectId}`)
  }

  return (
    <>
      <div className={`vacancy-card-container ${ownerIsBanned ? 'banned-owner-card' : ''} ${!clickable ? 'no-active' : ''}`} onClick={handleCardClick}>
        {canModerate && (
          <button className='moderation-delete-btn' onClick={handleModerationDelete}>
            <RejectIcon className='ico' />
          </button>
        )}

        <div className='vacancy-info-container'>
          <div className='vacancy-header'>
            <div className='vacancy-header-left'>
              <p className='vacancy-title'>{vacancy.title}</p>
              <p className='vacancy-project-name'>{vacancy.projectTitle}</p>
            </div>
          </div>
          <p className='vacancy-description'>{vacancy.description}</p>
        </div>
        
        {vacancy.requiredTags && vacancy.requiredTags.length > 0 && (
          <div className='tag-place-container'>
            {vacancy.requiredTags.map((tag, index) => (
              <div key={index} className='tag-item'>
                <p className='tag-text'>{tag}</p>
              </div>
            ))}
          </div>
        )}
        
        <div className='vacancy-footer-container'>
          <div className='vacancy-left-group'>
            <button 
              className='vacancy-apply-button' 
              onClick={handleApply} 
              disabled={!isAuthenticated || hasResponded || isOwner || isTeamMember || applyMutation.isPending || ownerIsBanned}
            >
              Откликнуться
            </button>
            <span className='vacancy-rating'>
              <StarIcon className='star-ico' />
              {vacancy.ratingCount || 0} оценок
            </span>
          </div>
          {vacancy.publishedAt && (
            <span className='vacancy-date'>
              <CalendarIcon className='calendar-ico' />
              <span>Опубликовано </span>
              {new Date(vacancy.publishedAt).toLocaleDateString('ru-RU')}
            </span>
          )}
        </div>
      </div>

      {showDeleteForm && (
        <DeleteVacancyModerationForm
          vacancyId={vacancy.vacancyId}
          vacancyTitle={vacancy.title}
          onClose={() => setShowDeleteForm(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.vacancies.allList() })
            if (vacancy.projectId) {
              queryClient.invalidateQueries({ queryKey: queryKeys.vacancies.byProject(vacancy.projectId) })
            }
          }}
        />
      )}
    </>
  )
}