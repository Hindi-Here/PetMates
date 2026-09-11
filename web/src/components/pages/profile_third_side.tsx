import './profile_third_side.scss'
import InviteIcon from '@icons/invite_in_project.svg?react'
import ChatIcon from '@icons/chat.svg?react'
import MoreIcon from '@icons/more.svg?react'
import LockIcon from '@icons/lock.svg?react'

import { useState, useMemo, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSystemRole } from '../hooks/useSystemRole'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import type { ThirdProfileData } from '../hooks/useThirdProfile'
import { usersApi } from '../services/users'
import { useQuery } from '@tanstack/react-query'

import InviteForm from '../forms/invite_user'
import BanUserForm from '../forms/ban_user'

export default function ThirdProfile() {
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [showBanForm, setShowBanForm] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const navigate = useNavigate()
  const { profileId } = useParams<{ profileId: string }>()
  const { isAuthenticated, userId } = useAuth()
  const currentSystemRole = useSystemRole()
  const queryClient = useQueryClient()

  const { data: user, isLoading  } = useQuery<ThirdProfileData>({
    queryKey: queryKeys.profile.byId(profileId!),
    queryFn: () => usersApi.getUserById(profileId!),
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  })

  const targetSystemRole = (user as any)?.systemRole as string | undefined
  const isModerationTarget = currentSystemRole === 'admin' ||
    (currentSystemRole === 'moderator' && targetSystemRole !== 'admin' && targetSystemRole !== 'moderator')
  const canModerate = isAuthenticated && userId !== profileId && isModerationTarget

  const isBanned = (user as any)?.isBanned === true
  const isStaff = currentSystemRole === 'admin' || currentSystemRole === 'moderator'
  
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

  const handleBan = () => {
    setIsMenuOpen(false)
    setShowBanForm(true)
  }

  const handleUnban = async () => {
    try {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.byId(profileId!) })
      queryClient.invalidateQueries({ queryKey: ['users', 'byId', profileId!] })
      setIsMenuOpen(false)
    } catch (error) {
      console.error('Ошибка разблокировки:', error)
    }
  }

  const handlePromote = async () => {
    try {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.byId(profileId!) })
      queryClient.invalidateQueries({ queryKey: ['users', 'byId', profileId!] })
      setIsMenuOpen(false)
    } catch (error) {
      console.error('Ошибка назначения модератора:', error)
    }
  }

  const handleDemote = async () => {
    try {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.byId(profileId!) })
      queryClient.invalidateQueries({ queryKey: ['users', 'byId', profileId!] })
      setIsMenuOpen(false)
    } catch (error) {
      console.error('Ошибка снятия модератора:', error)
    }
  }

  const handlePromoteToAdmin = async () => {
    try {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.byId(profileId!) })
      queryClient.invalidateQueries({ queryKey: ['users', 'byId', profileId!] })
      setIsMenuOpen(false)
    } catch (error) {
      console.error('Ошибка назначения админа:', error)
    }
  }

  const handleDemoteFromAdmin = async () => {
    try {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.byId(profileId!) })
      queryClient.invalidateQueries({ queryKey: ['users', 'byId', profileId!] })
      setIsMenuOpen(false)
    } catch (error) {
      console.error('Ошибка снятия админа:', error)
    }
  }

  const contactsList = useMemo(() => {
    try {
      return user?.contacts ? JSON.parse(user.contacts) : []
    } catch {
      return []
    }
  }, [user?.contacts])

  const renderOnlineStatus = () => {
    if (!user) return null
    if (user.isOnline) {
      return (
        <div className='online-container'>
          <div className='circle-online'></div>
          <p className='online-text'>Онлайн</p>
        </div>
      )
    }
    return <p className='online-text offline'>Был(а) {user.lastSeen}</p>
  }

  const shouldShowActions = isAuthenticated && userId !== profileId

  if (!isLoading && !isStaff && (!user || isBanned)) {
    return (
        <div className='banned-gate'>
            <div className='info-container'>
                <LockIcon className='info-ico' />
                <p className='info-comment'>Профиль недоступен</p>
                <p className='info-subcomment'>Пользователь заблокирован администрацией</p>
            </div>
        </div>
    )
  }

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

  const hardSkillsArray = parseSkills(user?.hardSkills);
  const softSkillsArray = parseSkills(user?.softSkills);

  return (
    <div className='third-profile-content'>
      {user && (
        <>
          <div className='profile-header-container'>
            <img className='profile-avatar' src={user?.avatarUrl || '/default-avatar.png'} alt={user?.nickname} />
            <div className='profile-username-container'>
              <div className='username-main'>
                <h1 className='username'>{user?.nickname}</h1>
                {user?.realName && <span className='real-name'>({user?.realName})</span>}
              </div>
              <p className='profile-role'>{user?.profileRole || 'Не указана роль'}</p>
              {renderOnlineStatus()}
            </div>

            {shouldShowActions && (
              <div className='profile-actions'>
                <button
                  className='profile-action-btn'
                  onClick={() => navigate(`/profile/${userId}/messages?to=${profileId}`)}
                >
                  <ChatIcon className='action-ico' />
                </button>
                <button
                  className='profile-action-btn'
                  onClick={() => setShowInviteForm(true)}
                >
                  <InviteIcon className='action-ico' />
                </button>
                
                {canModerate && (
                  <div className='profile-moderation-menu-wrapper' ref={menuRef}>
                    <button 
                      className='profile-moderation-menu-btn'
                      onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen) }}
                    >
                      <MoreIcon className='action-ico' />
                    </button>

                    {isMenuOpen && (
                      <div className='profile-moderation-menu'>
                        {(user as any).isBanned ? (
                          <button onClick={(e) => { e.stopPropagation(); handleUnban() }}>Разблокировать</button>
                        ) : (
                          <button className='danger' onClick={(e) => { e.stopPropagation(); handleBan() }}>Заблокировать</button>
                        )}

                        {currentSystemRole === 'admin' && (
                          <>
                            {targetSystemRole === 'admin' ? (
                              <button className='danger' onClick={(e) => { e.stopPropagation(); handleDemoteFromAdmin() }}>
                                Снять администратора
                              </button>
                            ) : targetSystemRole === 'user' ? (
                              <button onClick={(e) => { e.stopPropagation(); handlePromoteToAdmin() }}>
                                Назначить администратором
                              </button>
                            ) : null}
                            
                            {targetSystemRole === 'moderator' ? (
                              <button onClick={(e) => { e.stopPropagation(); handleDemote() }}>
                                Снять модератора
                              </button>
                            ) : targetSystemRole === 'user' ? (
                              <button onClick={(e) => { e.stopPropagation(); handlePromote() }}>
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
              { label: 'Страна', value: user?.country },
              { label: 'Город', value: user?.city },
              { label: 'Место учебы/работы', value: user?.workplace },
              { label: 'Возраст', value: user?.age ? `${user?.age} лет` : null },
              { label: 'Пол', value: user?.gender === 'male' ? 'Мужской' : user?.gender === 'female' ? 'Женский' : null }
            ]
              .filter(item => item.value)
              .map((item, i) => (
                <div key={i} className='meta-item'>
                  <p className='meta-label'>{item.label}:</p>
                  <p className='meta-value'>{item.value}</p>
                </div>
              ))}
          </div>

          {user?.description && (
            <div className='profile-area-container'>
              <div className='profile-area-text-container'>
                <p className='profile-area-text'>Описание:</p>
              </div>
              <div className='description-text markdown-content'>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{user.description}</ReactMarkdown>
              </div>
            </div>
          )}

          <div className='profile-area-container'>
            <div className='profile-area-text-container'>
              <p className='profile-area-text'>hard-skills:</p>
            </div>
            <div className='tag-container'>
              {hardSkillsArray.length > 0 ? (
                hardSkillsArray.map((skill, index) => (
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
          </div>

          <div className='profile-area-container'>
            <div className='profile-area-text-container'>
              <p className='profile-area-text'>soft-skills:</p>
            </div>
            <div className='tag-container'>
              {softSkillsArray.length > 0 ? (
                softSkillsArray.map((skill, index) => (
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
          </div>

          <div className='profile-area-container'>
            <div className='profile-area-text-container'>
              <p className='profile-area-text'>Контакты:</p>
            </div>
            {contactsList.length > 0 ? (
              <div className='contacts-list'>
                {contactsList.map((contact: {name: string; link: string }, index: number) => (
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
        </>
      )}

      {showInviteForm && user && (
        <InviteForm
          onClose={() => setShowInviteForm(false)}
          invitedUser={user as ThirdProfileData}
        />
      )}

      {showBanForm && user && (
        <BanUserForm
          userId={user.userId}
          nickname={user.nickname}
          onClose={() => setShowBanForm(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.profile.byId(profileId!) })
            queryClient.invalidateQueries({ queryKey: ['users', 'byId', profileId!] })
          }}
        />
      )}
    </div>
  )
}