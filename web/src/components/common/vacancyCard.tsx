import './vacancyCard.scss'

import CalendarIcon from '@icons/calendar.svg?react'
import StarIcon from '@icons/star.svg?react'

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { projectsApi } from '../services/project'
import { responseApi } from '../services/response'
import { notificationApi } from '../services/notification'
import { usersApi } from '../services/users'
import type { VacancyData } from '../services/vacancy'

const sendNotification = (
  userId: string,
  referenceType: string,
  referenceId: string,
  eventType: string,
  contextData: Record<string, any>
) => {
  notificationApi.create({
    userId,
    referenceType,
    referenceId,
    contextData: {
      ...contextData,
      eventType,
    }
  }).catch(err => console.error('Ошибка создания уведомления:', err))
}

export const VacancyCard = ({ vacancy }: { vacancy: VacancyData }) => {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  
  const { data: responseStatus } = useQuery({
    queryKey: ['response-status', vacancy.vacancyId, userId],
    queryFn: () => userId ? responseApi.checkResponse(vacancy.vacancyId) : null,
    enabled: !!userId,
    staleTime: 1 * 60 * 1000,
  })
  
  const hasResponded = responseStatus?.hasResponded || false
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null)
  const [currentUserNickname, setCurrentUserNickname] = useState<string | null>(null)

  useEffect(() => {
    const checkOwner = async () => {
      if (!userId || !vacancy.projectId) return
      try {
        const project = await projectsApi.getProject(vacancy.projectId)
        setProjectOwnerId(project.ownerId)
        
        const currentUser = await usersApi.getUserById(userId)
        setCurrentUserNickname(currentUser?.nickname || null)
      } catch (error) {
        console.error('Ошибка проверки владельца:', error)
      }
    }
    checkOwner()
  }, [vacancy.projectId, userId])

  const isOwner = projectOwnerId === userId

  const applyMutation = useMutation({
    mutationFn: () => responseApi.create({ 
      userId: userId!, 
      vacancyId: vacancy.vacancyId, 
      status: 'pending' 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['response-status', vacancy.vacancyId, userId] 
      })
      
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
    if (hasResponded || isOwner || !userId) return
    applyMutation.mutate()
  }

  const handleCardClick = () => {
    if (!projectOwnerId) return
    navigate(`/profile/${projectOwnerId}/activity/project/${vacancy.projectId}`)
  }

  return (
    <div className='vacancy-card-container' onClick={handleCardClick}>
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
            disabled={hasResponded || isOwner || applyMutation.isPending}
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
  )
}