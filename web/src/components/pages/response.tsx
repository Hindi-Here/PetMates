import './response.scss'

import InfoIcon from '@icons/info.svg?react'
import UsersIcon from '@icons/users.svg?react'
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { responseApi, type ResponseData } from '../services/response'
import { inviteApi, type InviteData } from '../services/invite'
import { projectsApi } from '../services/project'
import { notificationApi } from '../services/notification'
import { usersApi } from '../services/users'

// Отправка уведомления пользователю
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

// Рендер карточки входящего отклика
const renderIncomingResponseCard = (
  response: ResponseData,
  onAction: (responseId: string, action: 'accept' | 'decline', response: ResponseData) => void,
  onNavigate: (projectId: string) => void
) => (
  <div
    key={response.responseId}
    className='response-card'
    onClick={(e) => { e.stopPropagation(); onNavigate(response.projectId) }}>
    <div className='response-card-header'>
      <div className='response-icon-wrapper'>
        <InfoIcon className='response-icon' />
      </div>
      <div className='response-text'>
        <p>
          Вы получили отклик от <strong><em>{response.userNickname}</em></strong> на проект{' '}
          <span className='response-project'><em>{response.projectTitle}</em></span> на роль{' '}
          <span className='response-role'><em>{response.vacancyTitle}</em></span>
        </p>
        <p className='response-date'>
          {new Date(response.createdAt).toLocaleDateString('ru-RU')}
          {', '}
          {new Date(response.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
    <div className='response-actions'>
      <button className='response-button accept' onClick={(e) => { e.stopPropagation(); onAction(response.responseId, 'accept', response) }}>
        Принять
      </button>
      <button className='response-button decline' onClick={(e) => { e.stopPropagation(); onAction(response.responseId, 'decline', response) }}>
        Отклонить
      </button>
    </div>
  </div>
)

// Рендер карточки исходящего отклика
const renderOutgoingResponseCard = (
  response: ResponseData,
  onCancel: (response: ResponseData) => void,
  onNavigate: (projectId: string) => void
) => (
  <div
    key={response.responseId}
    className='response-card'
    onClick={(e) => { e.stopPropagation(); onNavigate(response.projectId) }}>
    <div className='response-card-header'>
      <div className='response-icon-wrapper'>
        <InfoIcon className='response-icon' />
      </div>
      <div className='response-text'>
        <p>
          Отклик на участие в проекте{' '}
          <span className='response-project'><em>{response.projectTitle}</em></span> на роль{' '}
          <span className='response-role'><em>{response.vacancyTitle}</em></span> был отправлен
        </p>
        <p className='response-date'>
          {new Date(response.createdAt).toLocaleDateString('ru-RU')}
          {', '}
          {new Date(response.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
    <div className='response-actions'>
      <button className='response-button decline' onClick={(e) => { e.stopPropagation(); onCancel(response) }}>
        Отменить
      </button>
    </div>
  </div>
)

// Рендер карточки входящего приглашения
const renderIncomingInviteCard = (
  invite: InviteData,
  onAction: (inviteId: string, action: 'accept' | 'decline', invite: InviteData) => void,
  onNavigate: (projectId: string) => void
) => (
  <div
    key={invite.inviteId}
    className='response-card'
    onClick={(e) => { e.stopPropagation(); onNavigate(invite.projectId) }}>
    <div className='response-card-header'>
      <div className='response-icon-wrapper'>
        <InfoIcon className='response-icon' />
      </div>
      <div className='response-text'>
        <p>
          Вы получили приглашение от <strong><em>{invite.inviterName}</em></strong> к проекту{' '}
          <span className='response-project'><em>{invite.projectTitle}</em></span> на роль{' '}
          <span className='response-role'><em>{invite.role}</em></span>
        </p>
        <p className='response-date'>
          {new Date(invite.createdAt).toLocaleDateString('ru-RU')}
          {', '}
          {new Date(invite.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
    <div className='response-actions'>
      <button className='response-button accept' onClick={(e) => { e.stopPropagation(); onAction(invite.inviteId, 'accept', invite) }}>
        Принять
      </button>
      <button className='response-button decline' onClick={(e) => { e.stopPropagation(); onAction(invite.inviteId, 'decline', invite) }}>
        Отклонить
      </button>
    </div>
  </div>
)

// Рендер карточки исходящего приглашения
const renderOutgoingInviteCard = (
  invite: InviteData,
  onCancel: (invite: InviteData) => void,
  onNavigate: (projectId: string) => void
) => (
  <div
    key={invite.inviteId}
    className='response-card'
    onClick={(e) => { e.stopPropagation(); onNavigate(invite.projectId) }}>
    <div className='response-card-header'>
      <div className='response-icon-wrapper'>
        <InfoIcon className='response-icon' />
      </div>
      <div className='response-text'>
        <p>
          Приглашение <strong><em>{invite.userName}</em></strong> на участие в проекте{' '}
          <span className='response-project'><em>{invite.projectTitle}</em></span> на роль{' '}
          <span className='response-role'><em>{invite.role}</em></span> было отправлено
        </p>
        <p className='response-date'>
          {new Date(invite.createdAt).toLocaleDateString('ru-RU')}
          {', '}
          {new Date(invite.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
    <div className='response-actions'>
      <button className='response-button decline' onClick={(e) => { e.stopPropagation(); onCancel(invite) }}>
        Отменить
      </button>
    </div>
  </div>
)

export const Responses = () => {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [currentUserNickname, setCurrentUserNickname] = useState<string | null>(null)

  // Получение никнейма текущего пользователя
  useEffect(() => {
    const fetchNickname = async () => {
      if (!userId) return
      try {
        const user = await usersApi.getUserById(userId)
        setCurrentUserNickname(user?.nickname || null)
      } catch (error) {
        console.error('Ошибка получения никнейма:', error)
      }
    }
    fetchNickname()
  }, [userId])

  // Загрузка всех приглашений (входящие + исходящие)
  const { data: allInvites = [] } = useQuery({
    queryKey: queryKeys.invites.all,
    queryFn: async () => {
      const [inc, out] = await Promise.all([
        inviteApi.getIncoming(),
        inviteApi.getOutgoing()
      ])
      return [...inc, ...out]
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  // Загрузка входящих откликов на проекты пользователя
  const { data: incomingResponses = [] } = useQuery({
    queryKey: ['responses', 'incoming', userId],
    queryFn: async () => {
      if (!userId) return []
      const userProjects = await projectsApi.getProjectsByUser(userId)
      if (userProjects.length === 0) return []

      const responsePromises = userProjects.map(project =>
        responseApi.getByProject(project.projectId).catch(() => [])
      )
      const responsesArrays = await Promise.all(responsePromises)
      return responsesArrays.flat()
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  // Загрузка исходящих откликов пользователя
  const { data: outgoingResponses = [] } = useQuery({
    queryKey: ['responses', 'outgoing', userId],
    queryFn: () => responseApi.getOutgoing(userId!),
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  // Фильтрация входящих приглашений
  const incomingInvites = useMemo(() =>
    allInvites.filter((i: InviteData) => i.userId === userId),
    [allInvites, userId]
  )

  // Фильтрация исходящих приглашений
  const outgoingInvites = useMemo(() =>
    allInvites.filter((i: InviteData) => i.userId !== userId),
    [allInvites, userId]
  )

  // Мутация удаления отклика
  const deleteResponseMutation = useMutation({
    mutationFn: (responseId: string) => responseApi.delete(responseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responses', 'incoming', userId] })
      queryClient.invalidateQueries({ queryKey: ['responses', 'outgoing', userId] })
    },
  })

  // Мутация удаления приглашения
  const deleteInviteMutation = useMutation({
    mutationFn: (inviteId: string) => inviteApi.delete(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invites.all })
    },
  })

  // Обработка принятия/отклонения отклика
  const handleResponseAction = async (responseId: string, action: 'accept' | 'decline', response: ResponseData) => {
    try {
      await deleteResponseMutation.mutateAsync(responseId)

      const eventType = action === 'accept' ? 'response_accepted' : 'response_rejected'

      sendNotification(response.userId, 'response', response.projectId, eventType, {
        projectName: response.projectTitle || 'Проект',
        vacancyName: response.vacancyTitle || 'Заявка',
      })

      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
        refetchType: 'active'
      })
    } catch (error) {
      console.error('Ошибка обработки отклика:', error)
      queryClient.invalidateQueries({ queryKey: ['responses', 'incoming', userId] })
    }
  }

  // Обработка принятия/отклонения приглашения
  const handleInviteAction = async (inviteId: string, action: 'accept' | 'decline', invite: InviteData) => {
    try {
      await deleteInviteMutation.mutateAsync(inviteId)

      const eventType = action === 'accept' ? 'invite_accepted' : 'invite_rejected'

      try {
        const project = await projectsApi.getProject(invite.projectId)
        sendNotification(project.ownerId, 'invite', invite.projectId, eventType, {
          projectName: invite.projectTitle || 'Проект',
          vacancyName: invite.role || 'Заявка',
          nickname: currentUserNickname || 'Пользователь',
        })
      } catch (error) {
        console.error('Ошибка получения проекта для уведомления:', error)
      }

      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
        refetchType: 'active'
      })
    } catch (error) {
      console.error('Ошибка обработки приглашения:', error)
    }
  }

  // Отмена исходящего отклика
  const handleCancelResponse = async (response: ResponseData) => {
    try {
      await deleteResponseMutation.mutateAsync(response.responseId)

      try {
        const project = await projectsApi.getProject(response.projectId)
        sendNotification(project.ownerId, 'response', response.projectId, 'response_cancelled', {
          projectName: response.projectTitle || 'Проект',
          vacancyName: response.vacancyTitle || 'Заявка',
          nickname: currentUserNickname || 'Пользователь',
        })
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.all,
          refetchType: 'active'
        })
      } catch (error) {
        console.error('Ошибка получения проекта для уведомления:', error)
      }
    } catch (error) {
      console.error('Ошибка отмены отклика:', error)
    }
  }

  // Отмена исходящего приглашения
  const handleCancelInvite = async (invite: InviteData) => {
    try {
      await deleteInviteMutation.mutateAsync(invite.inviteId)

      sendNotification(invite.userId, 'invite', invite.projectId, 'invite_cancelled', {
        projectName: invite.projectTitle || 'Проект',
        vacancyName: invite.role || 'Заявка',
        nickname: currentUserNickname || 'Пользователь',
      })

      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
        refetchType: 'active'
      })
    } catch (error) {
      console.error('Ошибка отмены приглашения:', error)
    }
  }

  // Навигация к странице проекта
  const navigateToProject = async (projectId: string) => {
    try {
      const project = await projectsApi.getProject(projectId)
      navigate(`/profile/${project.ownerId}/activity/project/${projectId}`)
    } catch {
      console.error('Не удалось загрузить проект')
    }
  }

  // Проверка: есть ли какие-либо отклики или приглашения
  const hasAnyItems = allInvites.length > 0 || incomingResponses.length > 0 || outgoingResponses.length > 0

  return (
    <div className='responses-page'>
      {incomingResponses.length > 0 && (
        <section className='response-section'>
          <h2 className='response-section-title'>
            Входящие отклики: <span className='response-count'>{incomingResponses.length}</span>
          </h2>
          <div className='response-list'>
            {incomingResponses.map(response =>
              renderIncomingResponseCard(response, handleResponseAction, navigateToProject)
            )}
          </div>
        </section>
      )}

      {outgoingResponses.length > 0 && (
        <section className='response-section'>
          <h2 className='response-section-title'>
            Исходящие отклики: <span className='response-count'>{outgoingResponses.length}</span>
          </h2>
          <div className='response-list'>
            {outgoingResponses.map(response =>
              renderOutgoingResponseCard(response, handleCancelResponse, navigateToProject)
            )}
          </div>
        </section>
      )}

      {incomingInvites.length > 0 && (
        <section className='response-section'>
          <h2 className='response-section-title'>
            Входящие приглашения: <span className='response-count'>{incomingInvites.length}</span>
          </h2>
          <div className='response-list'>
            {incomingInvites.map(invite =>
              renderIncomingInviteCard(invite, handleInviteAction, navigateToProject)
            )}
          </div>
        </section>
      )}

      {outgoingInvites.length > 0 && (
        <section className='response-section'>
          <h2 className='response-section-title'>
            Исходящие приглашения: <span className='response-count'>{outgoingInvites.length}</span>
          </h2>
          <div className='response-list'>
            {outgoingInvites.map(invite =>
              renderOutgoingInviteCard(invite, handleCancelInvite, navigateToProject)
            )}
          </div>
        </section>
      )}

      {!hasAnyItems && (
        <div className="empty-activity">
          <UsersIcon className="empty-activity-ico" />
          <p className="empty-activity-text">
            Приглашения и отклики отсутствуют
          </p>
        </div>
      )}
    </div>
  )
}