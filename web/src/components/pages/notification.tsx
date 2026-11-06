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
import { getNotificationIcon, getNotificationText, getNotificationLink } from '../common/notificationText'
import { TIMING } from '../scripts/limits'

type CategoryFilter = 'all' | 'projects' | 'requests' | 'system'

const categoryLabels: Record<CategoryFilter, string> = {
  all: 'Все',
  projects: 'Проекты',  
  requests: 'Заявки',    
  system: 'Системные',
}

const categoryOptions = Object.entries(categoryLabels).map(([id, label]) => ({ id, label }))

const CATEGORY_TYPES: Record<CategoryFilter, string[] | null> = {
  all: null,
  projects: ['project', 'event', 'comment'],
  requests: ['response', 'invite', 'application'],
  system: ['system'],
}

export const Notifications = () => {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all')
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  
  const { isOpen: isDropdownOpen, setIsOpen: setDropdownOpen, menuRef: dropdownMenuRef } = useIsOpen()

  const { data: allNotifications = [] } = useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: () => notificationApi.getAll(),
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const notifications = useMemo(() => {
    const types = CATEGORY_TYPES[selectedCategory]
    return types ? allNotifications.filter(n => types.includes(n.referenceType)) : allNotifications
  }, [allNotifications, selectedCategory])

  const [error, setError] = useState<string | null>(null)

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationApi.markAsRead(notificationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
    onError: (err: any) => {
      setError(err.message || 'Ошибка отметки уведомления')
      setTimeout(() => setError(null), TIMING.toastMs)
    },
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
    onError: (err: any) => {
      setError(err.message || 'Ошибка отметки всех уведомлений')
      setTimeout(() => setError(null), TIMING.toastMs)
    },
  })

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) => notificationApi.delete(notificationId),
    onSuccess: async (_data, notificationId) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      setSelectedNotifications(prev => {
        const newSet = new Set(prev)
        newSet.delete(notificationId)
        return newSet
      })
    },
    onError: (err: any) => {
      setError(err.message || 'Ошибка удаления уведомления')
      setTimeout(() => setError(null), TIMING.toastMs)
    },
  })

  const deleteSelectedNotificationsMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      await Promise.all(notificationIds.map(id => notificationApi.delete(id)))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      setSelectedNotifications(new Set())
      setIsSelectionMode(false)
    },
    onError: (err: any) => {
      setError(err.message || 'Ошибка удаления выбранных уведомлений')
      setTimeout(() => setError(null), TIMING.toastMs)
    },
  })

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId)
  }

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate()
  }

  const handleDeleteSelected = () => {
    deleteSelectedNotificationsMutation.mutate(Array.from(selectedNotifications))
  }

  const handleDeleteOne = (notificationId: string) => {
    deleteNotificationMutation.mutate(notificationId)
  }

  const handleCategorySelect = (item: { id: string; label: string }) => {
    setSelectedCategory(item.id as CategoryFilter)
    setDropdownOpen(false)
    setSelectedNotifications(new Set())
    setIsSelectionMode(false)
  }

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

  const handleSelectAll = () => {
    if (selectedNotifications.size === notifications.length) {
      setSelectedNotifications(new Set())
    }
    else {
      setSelectedNotifications(new Set(notifications.map(n => n.notificationId)))
    }
  }

  const handleNotificationClick = async (notification: NotificationData) => {
    if (!notification.isRead) await handleMarkAsRead(notification.notificationId)
    const link = getNotificationLink(notification, userId)
    if (link) navigate(link)
  }

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

        {error && (
          <p className='save-error-text message-auto-hide' onAnimationEnd={() => setError(null)}>
            {error}
          </p>
        )}

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