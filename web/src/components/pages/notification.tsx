import './notification.scss'

import UsersIcon from '@icons/users.svg?react'
import RejectIcon from '@icons/reject.svg?react'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Dropdown } from '../common/dropdown'
import { useIsOpen } from '../scripts/function'
import DropdownIcon from '@icons/dropdown.svg?react'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { notificationApi, type NotificationData } from '../services/notification'
import { getNotificationIcon, getNotificationText } from '../common/notificationText'

type CategoryFilter = 'all' | 'project' | 'response' | 'invite' | 'system'

// Маппинг категорий для отображения в UI
const categoryLabels: Record<CategoryFilter, string> = {
  all: 'Все',
  project: 'Проекты',
  response: 'Отклики',
  invite: 'Приглашения',
  system: 'Системные'
}

// Опции для выпадающего списка категорий
const categoryOptions = [
  { id: 'all', label: 'Все' },
  { id: 'project', label: 'Проекты' },
  { id: 'response', label: 'Отклики' },
  { id: 'invite', label: 'Приглашения' },
  { id: 'system', label: 'Системные' }
]

export const Notifications = () => {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all')
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  
  const { isOpen: isDropdownOpen, setIsOpen: setDropdownOpen, menuRef: dropdownMenuRef } = useIsOpen()

  // Загрузка уведомлений с фильтрацией по категории
  const { data: notifications = [] } = useQuery({
    queryKey: selectedCategory === 'all' 
      ? queryKeys.notifications.all 
      : queryKeys.notifications.byCategory(selectedCategory),
    queryFn: async () => {
      if (!userId) return []
      const referenceType = selectedCategory === 'all' ? undefined : selectedCategory
      return await notificationApi.getAll(referenceType)
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  // Мутация отметки одного уведомления как прочитанного
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationApi.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications.all,
        refetchType: 'active'
      })
      if (selectedCategory !== 'all') {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.notifications.byCategory(selectedCategory),
          refetchType: 'active'
        })
      }
    },
  })

  // Мутация отметки всех уведомлений как прочитанных
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications.all,
        refetchType: 'active'
      })
      if (selectedCategory !== 'all') {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.notifications.byCategory(selectedCategory),
          refetchType: 'active'
        })
      }
    },
  })

  // Мутация удаления одного уведомления
  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) => notificationApi.delete(notificationId),
    onSuccess: (_data, notificationId) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications.all,
        refetchType: 'active'
      })
      if (selectedCategory !== 'all') {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.notifications.byCategory(selectedCategory),
          refetchType: 'active'
        })
      }
      setSelectedNotifications(prev => {
        const newSet = new Set(prev)
        newSet.delete(notificationId)
        return newSet
      })
    },
  })

  // Мутация массового удаления выбранных уведомлений
  const deleteSelectedNotificationsMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      await Promise.all(notificationIds.map(id => notificationApi.delete(id)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications.all,
        refetchType: 'active'
      })
      if (selectedCategory !== 'all') {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.notifications.byCategory(selectedCategory),
          refetchType: 'active'
        })
      }
      setSelectedNotifications(new Set())
      setIsSelectionMode(false)
    },
  })

  // Отметка уведомления как прочитанного с обработкой ошибок
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsReadMutation.mutateAsync(notificationId)
    }
    catch (error) {
      console.error('Ошибка отметки уведомления:', error)
    }
  }

  // Отметка всех уведомлений как прочитанных с обработкой ошибок
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync()
    }
    catch (error) {
      console.error('Ошибка отметки всех уведомлений:', error)
    }
  }

  // Обработка выбора категории из выпадающего списка
  const handleCategorySelect = (item: { id: string; label: string }) => {
    setSelectedCategory(item.id as CategoryFilter)
    setDropdownOpen(false)
    setSelectedNotifications(new Set())
    setIsSelectionMode(false)
  }

  // Переключение выбора отдельного уведомления
  const handleSelectNotification = (notificationId: string) => {
    setSelectedNotifications(prev => {
      const newSet = new Set(prev)
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId)
      }
      else {
        newSet.add(notificationId)
      }
      return newSet
    })
  }

  // Выбор/снятие всех уведомлений сразу
  const handleSelectAll = () => {
    if (selectedNotifications.size === notifications.length) {
      setSelectedNotifications(new Set())
    }
    else {
      setSelectedNotifications(new Set(notifications.map(n => n.notificationId)))
    }
  }

  // Удаление всех выбранных уведомлений с обработкой ошибок
  const handleDeleteSelected = async () => {
    try {
      await deleteSelectedNotificationsMutation.mutateAsync(Array.from(selectedNotifications))
    }
    catch (error) {
      console.error('Ошибка удаления выбранных уведомлений:', error)
    }
  }

  // Удаление одного уведомления с обработкой ошибок
  const handleDeleteOne = async (notificationId: string) => {
    try {
      await deleteNotificationMutation.mutateAsync(notificationId)
    }
    catch (error) {
      console.error('Ошибка удаления уведомления:', error)
    }
  }

  // Обработка клика по уведомлению: чтение + навигация
  const handleNotificationClick = async (notification: NotificationData) => {
    if (!notification.isRead) {
      await handleMarkAsRead(notification.notificationId)
    }
    
    if ((notification.referenceType === 'project' || 
         notification.referenceType === 'response' || 
         notification.referenceType === 'invite') 
        && notification.referenceId) {
      navigate(`/profile/${userId}/activity/project/${notification.referenceId}`)
    }
  }

  // Рендер карточки одного уведомления
  const renderNotificationCard = (notification: NotificationData) => {
    const { icon: Icon, color, borderColor } = getNotificationIcon(notification.referenceType, notification.contextData)
    const text = getNotificationText(notification)
    const isSelected = selectedNotifications.has(notification.notificationId)

    return (
      <div 
        key={notification.notificationId} 
        className={`notification-card 
          ${!notification.isRead ? 'unread' : ''} 
          ${!notification.isRead ? `unread-${color}` : ''}
          ${isSelected ? 'selected' : ''}`}
        style={{ '--border-color': borderColor } as React.CSSProperties}
        onClick={() => handleNotificationClick(notification)}>
        <div className='notification-card-header'>
          {isSelectionMode && (
            <div 
              className='notification-checkbox-wrapper'
              onClick={(e) => e.stopPropagation()}
            >
              <input 
                type='checkbox' 
                checked={isSelected}
                onChange={() => handleSelectNotification(notification.notificationId)}
              />
            </div>
          )}

          <div className={`notification-icon-wrapper ${color}`}>
            <Icon className='notification-icon' />
          </div>

          <div className='notification-text'>
            <p>{text}</p>
            <p className='notification-date'>
              {new Date(notification.createdAt).toLocaleDateString('ru-RU')}
              {', '}
              {new Date(notification.createdAt).toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </div>

          <div className='notification-actions-right'>
            {!notification.isRead && (
              <div className={`unread-indicator ${color}`}  />
            )}

            <button 
              className='delete-notification-button'
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteOne(notification.notificationId)
              }}
              disabled={deleteNotificationMutation.isPending}>
              <RejectIcon className='delete-icon' />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Проверка: все ли уведомления выбраны
  const allSelected = useMemo(() => 
    notifications.length > 0 && selectedNotifications.size === notifications.length,
    [notifications.length, selectedNotifications.size]
  )

  return (
    <div className='notifications-page'>
      <div className='notifications-header'>
        <h2 className='notifications-title'>
          Уведомления: <span className='notifications-count'>{notifications.length}</span>
        </h2>

        <div className='notifications-controls'>
          <div className='sort-group-container' ref={dropdownMenuRef}>
            <div 
              className={`sort-type-container ${isDropdownOpen ? 'active' : ''}`}
              onClick={() => setDropdownOpen(!isDropdownOpen)}>
              <p className='sort-type-text'>{categoryLabels[selectedCategory]}</p>
              <DropdownIcon className={`sort-type-dropdown-ico ${isDropdownOpen ? 'rotated' : ''}`} />
            </div>
            <Dropdown 
              items={categoryOptions} 
              isOpen={isDropdownOpen} 
              onSelect={handleCategorySelect} />
          </div>

          <div className='notifications-actions'>
            <button 
              className='mark-all-read-button'
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}>
              <span>Прочитать все</span>
            </button>

            <button 
              className={`delete-action-button ${
                isSelectionMode 
                  ? (selectedNotifications.size > 0 ? 'active-delete' : 'cancel-mode') 
                  : ''
              }`}
              onClick={() => {
                if (!isSelectionMode) {
                  setIsSelectionMode(true)
                }
                else if (selectedNotifications.size === 0) {
                  setIsSelectionMode(false)
                }
                else {
                  handleDeleteSelected()
                }
              }}
              disabled={deleteSelectedNotificationsMutation.isPending && selectedNotifications.size > 0}>
              <span>
                {!isSelectionMode 
                  ? 'Удалить выбранные'
                  : selectedNotifications.size === 0 
                    ? 'Отменить удаление'
                    : `Удалить выделенные (${selectedNotifications.size})`
                }
              </span>
            </button>
          </div>
        </div>
      </div>

      {isSelectionMode && notifications.length > 0 && (
        <div className='notifications-selection-header'>
          <label className='select-all-label'>
            <input 
              type='checkbox' 
              checked={allSelected}
              onChange={handleSelectAll}/>
            <span>Выбрать все</span>
          </label>
        </div>
      )}

      <div className='notifications-list'>
        {notifications.map(renderNotificationCard)}
      </div>

      {notifications.length === 0 && (
        <div className="empty-activity">
          <UsersIcon className="empty-activity-ico" />
          <p className="empty-activity-text">
            Уведомления отсутствуют
          </p>
        </div>
      )}
    </div>
  )
}