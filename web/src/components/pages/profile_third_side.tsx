import './profile_third_side.scss'
import HardSkills from '@icons/hard_skills.svg?react'
import SoftSkills from '@icons/soft_skills.svg?react'
import Contacts from '@icons/contacts.svg?react'
import UserDescription from '@icons/user_description.svg?react'
import InviteIcon from '@icons/invite_in_project.svg?react'
import ChatIcon from '@icons/chat.svg?react'
import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { ThirdProfileData } from '../hooks/useThirdProfile'
import InviteForm from '../forms/invite_user'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { usersApi } from '../services/users'

export default function ThirdProfile() {
  const [showInviteForm, setShowInviteForm] = useState(false)
  const navigate = useNavigate()
  const { profileId } = useParams<{ profileId: string }>()
  const { isAuthenticated, userId } = useAuth()

  // Загрузка данных профиля третьего лица
  const { data: user } = useQuery<ThirdProfileData>({
    queryKey: queryKeys.profile.byId(profileId!),
    queryFn: () => usersApi.getUserById(profileId!),
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  })

  // Парсинг контактов из JSON-строки
  const contactsList = useMemo(() => {
    try {
      return user?.contacts ? JSON.parse(user.contacts) : []
    } catch {
      return []
    }
  }, [user?.contacts])

  // Рендер индикатора онлайн-статуса
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

  // Проверка: показывать ли кнопки действий (чат, приглашение)
  const shouldShowActions = isAuthenticated && userId !== profileId

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
                <UserDescription className='profile-area-ico' />
                <p className='profile-area-text'>Описание:</p>
              </div>
              <div className='description-text markdown-content'>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{user.description}</ReactMarkdown>
              </div>
            </div>
          )}

          <div className='profile-area-container'>
            <div className='profile-area-text-container'>
              <HardSkills className='profile-area-ico' />
              <p className='profile-area-text'>hard-skills:</p>
            </div>
            <div className='tag-container'>
              {user?.hardSkills && user.hardSkills.length > 0 ? (
                user.hardSkills.map((skill, index) => (
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
              <SoftSkills className='profile-area-ico' />
              <p className='profile-area-text'>soft-skills:</p>
            </div>
            <div className='tag-container'>
              {user?.softSkills && user.softSkills.length > 0 ? (
                user.softSkills.map((skill, index) => (
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
              <Contacts className='profile-area-ico' />
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
    </div>
  )
}