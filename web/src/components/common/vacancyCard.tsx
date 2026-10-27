import './vacancyCard.scss'

import CalendarIcon from '@icons/calendar.svg?react'
import StarIcon from '@icons/star.svg?react'
import RejectIcon from '@icons/reject.svg?react'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSystemRole } from '../hooks/useSystemRole'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { canModerateTarget } from '../scripts/moderation'
import { responseApi } from '../services/response'
import type { VacancyData } from '../services/vacancy'
import DeleteVacancyModerationForm from '../forms/delete_vacancy_moderation'
import { STALE } from '../scripts/query/queryClient'
import { useMyProjectIds } from '../hooks/useMyProjectIds'
import { TIMING } from '../scripts/limits'

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

  const { data: myProjectIds } = useMyProjectIds(userId)

  const projectOwnerId = vacancy.ownerId ?? null
  const projectOwnerRole = vacancy.ownerSystemRole ?? 'user'
  const ownerIsBanned = vacancy.ownerIsBanned ?? false
  const isOwner = !!userId && projectOwnerId === userId
  const isTeamMember = !!vacancy.projectId && !!myProjectIds?.has(vacancy.projectId)

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

  const [applyError, setApplyError] = useState<string | null>(null)

  const applyMutation = useMutation({
    mutationFn: () => responseApi.create({ 
      userId: userId!, 
      vacancyId: vacancy.vacancyId, 
      status: 'pending' 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.responses.outgoing(userId!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.responses.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all, refetchType: 'active' })
    },
    onError: (e: Error) => { setApplyError(e.message); setTimeout(() => setApplyError(null), TIMING.toastMs) },
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
        {applyError && <p className='field-error-text' style={{ padding: '0 1rem 1rem' }}>{applyError}</p>}
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