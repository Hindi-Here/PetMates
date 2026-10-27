import './profile_public_view.scss'
import InviteIcon from '@icons/invite_in_project.svg?react'
import ChatIcon from '@icons/chat.svg?react'
import MoreIcon from '@icons/more.svg?react'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { useSystemRole } from '../hooks/useSystemRole'
import { invalidateModeration } from '../scripts/query/invalidate'
import { moderationApi } from '../services/moderation'
import type { ThirdProfileData } from '../services/profile'

import InviteForm from '../forms/invite_user'
import BanUserForm from '../forms/ban_user'
import { Markdown } from '../common/markdown'
import { blocksApi } from '../services/blocks'

export type ProfilePublicData = ThirdProfileData & {
  systemRole?: string
  isBanned?: boolean
}

const parseSkills = (skillsData: string | string[] | null | undefined): string[] => {
  if (Array.isArray(skillsData)) return skillsData
  if (typeof skillsData === 'string') {
    if (skillsData.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(skillsData)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return skillsData.split(/[\s,]+/).filter(Boolean)
  }
  return []
}

interface ProfilePublicViewProps {
  user: ProfilePublicData
  isPreview?: boolean
}

// Компонент для отображения публичного профиля пользователя
export const ProfilePublicView = ({ user, isPreview = false }: ProfilePublicViewProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAuthenticated, userId } = useAuth()
  const currentSystemRole = useSystemRole()

  const [showInviteForm, setShowInviteForm] = useState(false)
  const [showBanForm, setShowBanForm] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen])

  const refreshUser = async () => {
    await invalidateModeration(queryClient)
  }

  const handleUnban = async () => {
    if (busy) return
    setBusy(true)
    try {
      await moderationApi.unbanUser(user.userId)
      await refreshUser()
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Не удалось разблокировать пользователя')
    } finally {
      setBusy(false)
      setIsMenuOpen(false)
    }
  }

  const targetSystemRole = user.systemRole
  const isModerationTarget = currentSystemRole === 'admin' ||
    (currentSystemRole === 'moderator' && targetSystemRole !== 'admin' && targetSystemRole !== 'moderator')
  const canModerate = !isPreview && isAuthenticated && userId !== user.userId && isModerationTarget
  const showActions = isPreview || (isAuthenticated && userId !== user.userId)

   const handleSetRole = async (role: 'user' | 'moderator' | 'admin') => {
    if (busy) return
    setBusy(true)
    try {
      await moderationApi.setRole(user.userId, role)
      await refreshUser()
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Не удалось изменить роль')
    } finally {
      setBusy(false)
      setIsMenuOpen(false)
    }
  }

  const contactsList = useMemo(() => {
    try {
      return user.contacts ? JSON.parse(user.contacts) : []
    } catch {
      return []
    }
  }, [user.contacts])

  const hardSkills = parseSkills(user.hardSkills)
  const softSkills = parseSkills(user.softSkills)

  const renderOnlineStatus = () => {
    if (isPreview || user.isOnline) {
      return (
        <div className='online-container'>
          <div className='circle-online'></div>
          <p className='online-text'>Онлайн</p>
        </div>
      )
    }
    return <p className='online-text offline'>Был(а) {user.lastSeen}</p>
  }

  const renderTags = (skills: string[]) => (
    <div className='tag-container'>
      {skills.length > 0 ? (
        skills.map((skill, index) => (
          <div key={index} className='tag-item'>
            <p className='tag-text'>{skill}</p>
          </div>
        ))
      ) : (
        <div className='tag-item empty'>
          <p className='tag-text empty'>Нет указанных ключевых навыков</p>
        </div>
      )}
    </div>
  )

  const [blockedByMe, setBlockedByMe] = useState(false)
  useEffect(() => {
    if (isPreview || !isAuthenticated || userId === user.userId) return
    blocksApi.isBlocked(user.userId).then(setBlockedByMe).catch(() => {})
  }, [user.userId, userId, isAuthenticated, isPreview])

  const toggleBlock = async () => {
    try {
      if (blockedByMe) await blocksApi.unblock(user.userId)
      else await blocksApi.block(user.userId)
      setBlockedByMe(!blockedByMe)
    } catch (e) {
      console.error(e instanceof Error ? e.message : 'Не удалось выполнить действие')
    }
  }

  return (
    <div className='profile-public-content'>
      <div className='profile-header-container'>
        <img className='profile-avatar' src={user.avatarUrl || '/default-avatar.png'} alt={user.nickname} />
        <div className='profile-username-container'>
          <div className='username-main'>
            <h1 className='username'>{user.nickname}</h1>
            {user.realName && <span className='real-name'>({user.realName})</span>}
          </div>
          <p className='profile-role'>{user.profileRole || 'Не указана роль'}</p>
          {renderOnlineStatus()}
        </div>

        {showActions && (
          <div className='profile-actions'>
            <button
              className='profile-action-btn'
              disabled={isPreview}
              onClick={() => navigate(`/profile/${userId}/messages?to=${user.userId}`)}
            >
              <ChatIcon className='action-ico' />
            </button>
            <button className='profile-action-btn' disabled={isPreview} onClick={() => setShowInviteForm(true)}>
              <InviteIcon className='action-ico' />
            </button>

            {!isPreview && (
              <button className='profile-block-btn' onClick={toggleBlock}>
                {blockedByMe ? 'Разблокировать' : 'Заблокировать'}
              </button>
            )}

            {canModerate && (
              <div className='profile-moderation-menu-wrapper' ref={menuRef}>
                <button
                  className='profile-moderation-menu-btn'
                  onClick={e => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen) }}
                >
                  <MoreIcon className='action-ico' />
                </button>

                {isMenuOpen && (
                  <div className='profile-moderation-menu'>
                    {user.isBanned ? (
                      <button disabled={busy} onClick={e => { e.stopPropagation(); handleUnban() }}>
                        Разблокировать
                      </button>
                    ) : (
                      <button
                        className='danger'
                        disabled={busy}
                        onClick={e => { e.stopPropagation(); setIsMenuOpen(false); setShowBanForm(true) }}
                      >
                        Заблокировать
                      </button>
                    )}

                    {currentSystemRole === 'admin' && (
                      <>
                        {targetSystemRole === 'admin' ? (
                          <button className='danger' disabled={busy} onClick={e => { e.stopPropagation(); handleSetRole('user') }}>
                            Снять модератора
                          </button>
                        ) : targetSystemRole === 'user' ? (
                          <button disabled={busy} onClick={e => { e.stopPropagation(); handleSetRole('admin') }}>
                            Назначить администратором
                          </button>
                        ) : null}

                        {targetSystemRole === 'moderator' ? (
                          <button disabled={busy} onClick={e => { e.stopPropagation(); handleSetRole('user') }}>
                            Снять модератора
                          </button>
                        ) : targetSystemRole === 'user' ? (
                          <button disabled={busy} onClick={e => { e.stopPropagation(); handleSetRole('moderator') }}>
                            Назначить модератором
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className='profile-meta-container'>
        {[
          { label: 'Страна', value: user.country },
          { label: 'Город', value: user.city },
          { label: 'Место учебы/работы', value: user.workplace },
          { label: 'Возраст', value: user.age ? `${user.age} лет` : null },
          { label: 'Пол', value: user.gender === 'male' ? 'Мужской' : user.gender === 'female' ? 'Женский' : null },
        ]
          .filter(item => item.value)
          .map((item, i) => (
            <div key={i} className='meta-item'>
              <p className='meta-label'>{item.label}:</p>
              <p className='meta-value'>{item.value}</p>
            </div>
          ))}
      </div>

      {user.description && (
        <div className='profile-area-container'>
          <div className='profile-area-text-container'>
            <p className='profile-area-text'>Описание:</p>
          </div>
          <div className='description-text markdown-content'>
            <Markdown>{user.description}</Markdown>
          </div>
        </div>
      )}

      <div className='profile-area-container'>
        <div className='profile-area-text-container'>
          <p className='profile-area-text'>hard-skills:</p>
        </div>
        {renderTags(hardSkills)}
      </div>

      <div className='profile-area-container'>
        <div className='profile-area-text-container'>
          <p className='profile-area-text'>soft-skills:</p>
        </div>
        {renderTags(softSkills)}
      </div>

      <div className='profile-area-container'>
        <div className='profile-area-text-container'>
          <p className='profile-area-text'>Контакты:</p>
        </div>
        {contactsList.length > 0 ? (
          <div className='contacts-list'>
            {contactsList.map((contact: { name: string; link: string }, index: number) => (
              <div key={index} className='contact-item'>
                <p className='contact-name'>{contact.name}:</p>
                <p className='contact-link'>{contact.link}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className='contact-item empty'>
            <p className='contact-text empty'>Контакты не указаны</p>
          </div>
        )}
      </div>

      {showInviteForm && <InviteForm onClose={() => setShowInviteForm(false)} invitedUser={user} />}

      {showBanForm && (
        <BanUserForm
          userId={user.userId}
          nickname={user.nickname}
          onClose={() => setShowBanForm(false)}
          onSuccess={refreshUser}
        />
      )}
    </div>
  )
}