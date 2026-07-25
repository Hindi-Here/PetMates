import './notification.scss'

import UsersIcon from '@icons/users.svg?react'
import RejectIcon from '@icons/reject.svg?react'
import { useState } from 'react'
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

export const Notifications = () => {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all')
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  
  const { isOpen: isDropdownOpen, setIsOpen: setDropdownOpen, menuRef: dropdownMenuRef } = useIsOpen()

  const categoryLabels: Record<CategoryFilter, string> = {
    all: 'Все',
    project: 'Проекты',
    response: 'Отклики',
    invite: 'Приглашения',
    system: 'Системные'
  }

  const categoryOptions = [
    { id: 'all', label: 'Все' },
    { id: 'project', label: 'Проекты' },
    { id: 'response', label: 'Отклики' },
    { id: 'invite', label: 'Приглашения' },
    { id: 'system', label: 'Системные' }
  ]

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

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsReadMutation.mutateAsync(notificationId)
    }
    catch (error) {
      console.error('Ошибка отметки уведомления:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync()
    }
    catch (error) {
      console.error('Ошибка отметки всех уведомлений:', error)
    }
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

  const handleDeleteSelected = async () => {
    try {
      await deleteSelectedNotificationsMutation.mutateAsync(Array.from(selectedNotifications))
    }
    catch (error) {
      console.error('Ошибка удаления выбранных уведомлений:', error)
    }
  }

  const handleDeleteOne = async (notificationId: string) => {
    try {
      await deleteNotificationMutation.mutateAsync(notificationId)
    }
    catch (error) {
      console.error('Ошибка удаления уведомления:', error)
    }
  }

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

  const allSelected = notifications.length > 0 && selectedNotifications.size === notifications.length

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
        {notifications.map(notification => {
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
        })}
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