import LogoIcon from '@icons/icon.svg?react'
import DropdownIcon from '@icons/dropdown.svg?react'
import NotificationIcon from '@icons/notification.svg?react'
import MessageIcon from '@icons/message.svg?react'
import MenuIcon from '@icons/menu.svg?react'
import CloseIcon from '@icons/reject.svg?react'

import './header.scss'
import { AnimatedDropdown } from '../scripts/function';
import { useIsShort, useIsOpen } from '../scripts/function';
import { HeaderDropdownNavigation } from '../common/dropdown';

import { useState, useRef, useEffect } from 'react';
import AuthorizationForm from '../forms/authorization';

import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile'
import type { ProfileData } from '../hooks/useProfile'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { notificationApi, type NotificationData } from '../services/notification'
import { conversationApi } from '../services/conversation' // <-- ДОБАВЛЕНО
import { useNavigate } from 'react-router-dom'

import { getNotificationIcon, getNotificationText } from '../common/notificationText'

const Logo = () => {
  return (
    <div className='logo-container'> 
      <div className='ico-container'> 
        <LogoIcon className='logo-ico'></LogoIcon>
      </div>
      <div className='name-project-container'> 
        <p className='name-project-text'> PetMates </p>
      </div>
    </div>
  )
}

const Login = ({ onOpen }: any) => {
  return (
    <div className='login-container'>
      <button className='login-button' onClick={onOpen}> Войти </button>
    </div>
  )
}

const ShortMenu = () => {
  const { isOpen, setIsOpen, menuRef } = useIsOpen();
  const openMenu = () => setIsOpen(X => !X);

  return(
    <div ref={menuRef} className={`short-menu-container ${isOpen ? 'open' : ''}`} onClick={openMenu}>
      <MenuIcon className='short-menu-ico'/>
      <AnimatedDropdown isOpen={isOpen} className="dropdown-wrapper">
        <HeaderDropdownNavigation />
      </AnimatedDropdown>
    </div>
  )
}

const NotificationPanel = ({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void 
}) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { userId } = useAuth()
  const panelRef = useRef<HTMLDivElement>(null)

  const { data: notifications = [] } = useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: () => notificationApi.getAll(),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    enabled: isOpen,
  })

  const recentNotifications = notifications.slice(0, 25)

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationApi.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        const notificationIcon = document.querySelector('.notification-panel-container')
        if (notificationIcon && !notificationIcon.contains(event.target as Node)) {
          onClose()
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const handleNotificationClick = async (notification: NotificationData) => {
    if (!notification.isRead) {
      await markAsReadMutation.mutateAsync(notification.notificationId)
    }
    
    if ((notification.referenceType === 'project' || 
         notification.referenceType === 'response' || 
         notification.referenceType === 'invite') 
        && notification.referenceId) {
      navigate(`/profile/${userId}/activity/project/${notification.referenceId}`)
      onClose()
    }
  }

  const handleMarkAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation()
    markAllAsReadMutation.mutateAsync()
  }

  return (
    <div 
      ref={panelRef}
      className={`notification-panel-dropdown ${isOpen ? 'open' : ''}`}
      onClick={(e) => e.stopPropagation()}>
      <div className='notification-panel-header'>
        <p className='notification-panel-header text'>Уведомления</p>
        <div className='header-actions'>
          <button 
            className='mark-all-read-btn' 
            onClick={handleMarkAllAsRead}
            disabled={markAllAsReadMutation.isPending}>
            <span>Прочитать все</span>
          </button>
          <button className='close-panel-btn' onClick={onClose}>
            <CloseIcon className='close-icon' />
          </button>
        </div>
      </div>

      <div className='notification-panel-list'>
        {recentNotifications.length === 0 ? (
          <div className='empty-notifications'>
            <p>Нет уведомлений</p>
          </div>
        ) : (
          recentNotifications.map(notification => {
            const { icon: Icon, color } = getNotificationIcon(notification.referenceType, notification.contextData)
            const text = getNotificationText(notification)
            const date = new Date(notification.createdAt)

            return (
              <div 
                key={notification.notificationId}
                className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className={`notification-item-icon ${color}`}>
                  <Icon className='icon' />
                </div>
                <div className='notification-item-content'>
                  <p className='notification-item-text'>{text}</p>
                  <span className='notification-item-time'>
                    {date.toLocaleDateString('ru-RU')}, {date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {!notification.isRead && <div className='unread-dot' />}
              </div>
            )
          })
        )}
      </div>

      <div className='notification-panel-footer'>
        <button 
          className='view-all-btn'
          onClick={() => {
            navigate(`/profile/${userId}/notifications`)
            onClose()
          }}>
          Смотреть всю историю уведомлений →
        </button>
      </div>
    </div>
  )
}

export default function Header() {
  const { isAuthenticated } = useAuth();
  const { data: user } = useProfile(isAuthenticated);
  const isShortVer = useIsShort(965);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <div className='header'>
      <div className="container">
        <Logo />
        <div className="header-short-container">
          {isAuthenticated && <Profile user={user} />}
          {!isAuthenticated && <Login onOpen={() => setIsAuthOpen(true)} />}
          {isShortVer && !isAuthenticated && <ShortMenu />}
        </div>
        {isAuthOpen && <AuthorizationForm onClose={() => setIsAuthOpen(false)} />}
      </div>
    </div>
  )
}

const Profile = ({ user }: { user: ProfileData | null }) => {
  const { isOpen, setIsOpen, menuRef } = useIsOpen();
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const navigate = useNavigate();
  const { userId } = useAuth();
  const openMenu = () => { setIsOpen(X => !X); };

  const { data: notifications = [] } = useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: () => notificationApi.getAll(),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  const { data: conversations = [] } = useQuery({
    queryKey: queryKeys.conversations?.all ?? ['conversations', 'all'],
    queryFn: () => conversationApi.getConversations(),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    enabled: !!userId,
  })

  const hasUnreadMessages = conversations.some((conv: any) => conv.hasUnread)

  return (
    <div className='profile-container'>
      <div className='notification-panel-wrapper'>
        <div 
          className='notification-panel-container'
          onClick={() => setIsNotificationPanelOpen(!isNotificationPanelOpen)}>
          <NotificationIcon className='notification-ico' fill='white' />
          {unreadCount > 0 && <div className='new-notification' />}
        </div>
        
        {isNotificationPanelOpen && (
          <NotificationPanel 
            isOpen={isNotificationPanelOpen}
            onClose={() => setIsNotificationPanelOpen(false)}/>
        )}
      </div>

      <div className='message-panel-wrapper'>
        <div 
          className='message-panel-container'
          onClick={() => navigate(`/profile/${userId}/messages`)}>
          <MessageIcon className='message-ico' fill='white' />
          {hasUnreadMessages && <div className='new-message' />}
        </div>
      </div>

      <div ref={menuRef} className={`profile-panel-container ${isOpen ? 'open' : ''}`} onClick={openMenu}>
        <div className='avatar-container'>
          <img className='avatar-image' src={user?.avatarUrl} alt="Avatar" />
        </div>
        <div className='username-container'>
          <p className='username-text'>
            {user?.nickname && user.nickname.length > 15 ? user.nickname.slice(0, 15) + '…' : user?.nickname}
          </p>
          <p className='mail-text'>
            {user?.email && user.email.length > 25 ? user.email.slice(0, 25) + '…' : user?.email}
          </p>
        </div>
        <div className='dropdown-ico-container'>
          <DropdownIcon className={`dropdown-ico ${isOpen ? 'rotated' : ''}`} fill='white' />
        </div>
      </div>
      
      <AnimatedDropdown isOpen={isOpen} className="dropdown-wrapper">
        <HeaderDropdownNavigation />
      </AnimatedDropdown>
    </div> 
  )
}