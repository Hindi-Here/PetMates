import './userCard.scss'

import AdminProjectIcon from '@icons/admin_project.svg?react'
import MoreIcon from '@icons/more.svg?react'

import { useState, useEffect, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUserActivity } from '../hooks/useUserActivity'
import { useSystemRole } from '../hooks/useSystemRole'
import { canModerateTarget } from '../scripts/moderation'
import { moderationApi } from '../services/moderation'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import type { UserData } from '../services/users'

import BanUserForm from '../forms/ban_user'

const getProjectCountText = (count: number): string => {
  if (count === 0) return 'проектах'
  const lastDigit = count % 10
  const lastTwoDigits = count % 100

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'проектах'
  if (lastDigit === 1) return 'проекте'
  if (lastDigit >= 2 && lastDigit <= 4) return 'проектах'

  return 'проектах'
}

export const UserCard = ({ 
  user, 
  onInvite,
  isOwner = false,
  role,
  disabledInvite = false,
  showModerationDelete = false
}: { 
  user: UserData
  onInvite?: (user: UserData) => void
  isOwner?: boolean
  role?: string
  disabledInvite?: boolean
  showModerationDelete?: boolean
})  => {
  const navigate = useNavigate()
  const isBanned = (user as any).isBanned
  const queryClient = useQueryClient()
  const { isAuthenticated, userId: authUserId } = useAuth()
  const currentSystemRole = useSystemRole()
  
  const canInvite = isAuthenticated && authUserId !== user.userId && !disabledInvite && !isBanned

  const targetSystemRole = (user as any).systemRole as string | undefined
  const canModerate = isAuthenticated &&
    authUserId !== user.userId &&
    canModerateTarget(currentSystemRole, targetSystemRole)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen])

  const [showBanForm, setShowBanForm] = useState(false)

  const handleBan = () => {
    setIsMenuOpen(false)
    setShowBanForm(true)
  }

  const handleUnban = async () => {
    await moderationApi.unbanUser(user.userId)
    queryClient.invalidateQueries({ queryKey: queryKeys.users.allList() })
    queryClient.invalidateQueries({ queryKey: ['users', 'byId', user.userId] })
    setIsMenuOpen(false)
  }

  const handleSetRole = async (newRole: 'user' | 'moderator' | 'admin') => {
    await moderationApi.setRole(user.userId, newRole)
    queryClient.invalidateQueries({ queryKey: queryKeys.users.allList() })
    queryClient.invalidateQueries({ queryKey: ['users', 'byId', user.userId] })
    setIsMenuOpen(false)
  }
  
  const metaInfo = [
    user.realName,
    user.age && `${user.age} лет`,
    user.city,
    user.workplace
  ].filter(Boolean)

  const parseSkills = (skillsData: any): string[] => {
  if (Array.isArray(skillsData)) return skillsData;
  if (typeof skillsData === 'string') {
    if (skillsData.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(skillsData);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return skillsData.split(/[\s,]+/).filter(Boolean);
  }
  return [];
};

  const skills: string[] = parseSkills(user?.hardSkills);
  
  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.invite-button, .moderation-menu-wrapper')) {
      return
    }
    navigate(`/profile/${user.userId}/info`)
  }

  const rowRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(metaInfo.length)

  useEffect(() => {
    const row = rowRef.current
    if (!row) return

    const calculateVisible = () => {
      requestAnimationFrame(() => {
        if (!row) return
        const rowWidth = row.clientWidth
        const nickEl = row.querySelector('.nickname-text') as HTMLElement
        if (!nickEl) return

        let usedWidth = nickEl.offsetWidth + 12
        let count = 0

        const items = row.querySelectorAll('.meta-item') as NodeListOf<HTMLElement>
        const separators = row.querySelectorAll('.meta-separator') as NodeListOf<HTMLElement>

        items.forEach((item, i) => {
          const sepWidth = i > 0 ? (separators[i - 1]?.offsetWidth ?? 0) + 8 : 0
          usedWidth += item.offsetWidth + 8 + sepWidth
          if (usedWidth <= rowWidth) count++
        })

        setVisibleCount(count)
      })
    }

    calculateVisible()

    const resizeObserver = new ResizeObserver(calculateVisible)
    resizeObserver.observe(row)

    return () => {
      resizeObserver.disconnect()
    }
  }, [metaInfo])

  const tagRowRef = useRef<HTMLDivElement>(null)
  const [visibleTagCount, setVisibleTagCount] = useState(skills.length)

   useEffect(() => {
    const row = tagRowRef.current
    if (!row) return

    const calculateVisibleTags = () => {
      requestAnimationFrame(() => {
        if (!row) return
        const rowWidth = row.clientWidth - 32
        let usedWidth = 0
        let count = 0

        const items = row.querySelectorAll('.tag-item:not(.more-tag)') as NodeListOf<HTMLElement>

        items.forEach((item) => {
          usedWidth += item.offsetWidth + 8
          if (usedWidth <= rowWidth) count++
        })

        if (count < skills.length) {
          const moreTag = row.querySelector('.more-tag') as HTMLElement
          const moreWidth = moreTag ? moreTag.offsetWidth + 8 : 50

          let recalc = 0
          usedWidth = 0
          items.forEach((item) => {
            usedWidth += item.offsetWidth + 8
            if (usedWidth + moreWidth <= rowWidth) recalc++
          })
          count = recalc
        }

        setVisibleTagCount(Math.max(count, 0))
      })
    }

    calculateVisibleTags()

    const resizeObserver = new ResizeObserver(calculateVisibleTags)
    resizeObserver.observe(row)

    return () => {
      resizeObserver.disconnect()
    }
  }, [skills])

  const { activityCount, loading: activityLoading } = useUserActivity(user.userId)

  return (
    <>
      <div className={`user-card-container 
        ${showModerationDelete ? 'with-moderation' : ''} 
        ${isBanned ? 'banned-user-card' : ''}`}
        onClick={handleCardClick}
      > 
        {canModerate && (
          <div className='moderation-menu-wrapper' ref={menuRef}>
            <button
              className={`moderation-menu-btn ${isBanned ? 'banned-menu-btn' : ''}`}
              onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen) }}
            >
              <MoreIcon className='ico' />
            </button>

            {isMenuOpen && (
              <div className='moderation-menu'>
                {(user as any).isBanned ? (
                  <button onClick={(e) => { e.stopPropagation(); handleUnban() }}>Разблокировать</button>
                ) : (
                  <button className='danger' onClick={(e) => { e.stopPropagation(); handleBan() }}>Заблокировать</button>
                )}

                {currentSystemRole === 'admin' && (
                  <>
                    {targetSystemRole === 'admin' ? (
                      <button onClick={(e) => { e.stopPropagation(); handleSetRole('user') }}>
                        Снять администратора
                      </button>
                    ) : (
                      <>
                        {targetSystemRole === 'moderator' ? (
                          <button onClick={(e) => { e.stopPropagation(); handleSetRole('user') }}>
                            Снять модератора
                          </button>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); handleSetRole('moderator') }}>
                            Назначить модератором
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleSetRole('admin') }}>
                          Назначить администратором
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className='info-place-container'>
          <div className='avatar-container'>
            <img className='avatar-ico' src={user.avatarUrl || '/default-avatar.png'} alt={user.nickname} />
          </div>
          <div className='info-container'>
            <div className='nickname-row' ref={rowRef}>
              <p className='nickname-text'>{user.nickname}</p>
              <div className='meta-info'>
                {metaInfo.map((item, index) => (
                  <Fragment key={index}>
                    {index > 0 && (
                      <div
                        className='meta-separator'
                        style={index >= visibleCount ? { position: 'absolute', visibility: 'hidden', pointerEvents: 'none' } : {}}
                      />
                    )}
                    <p
                      className='meta-item'
                      style={index >= visibleCount ? { position: 'absolute', visibility: 'hidden', pointerEvents: 'none' } : {}}
                    >
                      {item}
                    </p>
                  </Fragment>
                ))}
              </div>
              {isOwner && (
                <span className='owner-badge'>
                  <AdminProjectIcon className='owner-icon' />
                  Владелец
                </span>
              )}
            </div>
            <p className='role-text'>{role || user.profileRole || 'Нет указанной роли'}</p>
            {user.isOnline ? (
              <div className='online-container'>
                <div className='circle-online' />
                <p className='online-text'>Онлайн</p>
              </div>
            ) : (
              <p className='online-text offline'>Был(а) {user.lastSeen}</p>
            )}
          </div>
        </div>

        <div className='tag-place-container' ref={tagRowRef}>
          {skills.length === 0 ? (
            <div className='tag-item empty'>
              <p className='tag-text empty'>Нет указанных ключевых навыков</p>
            </div>
          ) : (
            <>
              {skills.map((skill, index) => (
                <div 
                  key={index} 
                  className='tag-item'
                  style={index >= visibleTagCount ? { position: 'absolute', visibility: 'hidden', pointerEvents: 'none' } : {}}>
                  <p className='tag-text'>{skill}</p>
                </div>
              ))}
              <div
                className='tag-item more-tag'
                style={visibleTagCount >= skills.length ? { position: 'absolute', visibility: 'hidden', pointerEvents: 'none' } : {}} >
                <p className='tag-text'>+{skills.length - visibleTagCount}</p>
              </div>
            </>
          )}
        </div>

        <div className='invite-place-container'>
          <button 
            className='invite-button' 
            disabled={!canInvite} 
            onClick={(e) => {
              e.stopPropagation()
              if (onInvite) onInvite(user)
            }}>
            {isBanned ? 'Заблокирован' : 'Пригласить'}
          </button>
          <p className='project-count-text'>
            {activityLoading 
              ? 'Активность в 0 проектах' 
              : `Активность в ${activityCount} ${getProjectCountText(activityCount)}`}
          </p>
        </div>
      </div>

      {showBanForm && (
        <BanUserForm
          userId={user.userId}
          nickname={user.nickname}
          onClose={() => setShowBanForm(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.users.allList() })
            queryClient.invalidateQueries({ queryKey: ['users', 'byId', user.userId] })
          }}
        />
      )}
    </>
  )
}

export { getProjectCountText }