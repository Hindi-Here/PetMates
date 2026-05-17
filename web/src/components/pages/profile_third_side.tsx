import './profile_third_side.scss'

import HardSkills from '@icons/hard_skills.svg?react'
import SoftSkills from '@icons/soft_skills.svg?react'
import Contacts from '@icons/contacts.svg?react'
import UserDescription from '@icons/user_description.svg?react'

import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { useUserProfile } from '../hooks/useThirdProfile'
import { useAuth } from '../hooks/useAuth' 
import type { ThirdProfileData } from '../hooks/useThirdProfile'
import InviteForm from '../forms/invite_user' 

export default function ThirdProfile () {
  const [activeTab, setActiveTab] = useState('Информация')
  const [showInviteForm, setShowInviteForm] = useState(false) 

  const { userId } = useParams<{ userId: string }>()
  const { data: user } = useUserProfile(userId)
  const { isAuthenticated } = useAuth()

  const contactsList: Array<{name: string, link: string}> = (() => {
    try {
      return user?.contacts ? JSON.parse(user.contacts) : []
    } catch {
      return []
    }
  })()

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

  return (
    <div className='profile-content-container third-profile'>
      <div className='tab-container'>
        <button className={`tab ${activeTab === 'Информация' ? 'active' : ''}`} onClick={() => setActiveTab('Информация')}>Информация</button>
        <button className={`tab ${activeTab === 'Активность' ? 'active' : ''}`} onClick={() => setActiveTab('Активность')}>Активность</button>
      </div>

      {activeTab === 'Информация' && (
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
                <p className='profile-area-text'> Описание:</p>
              </div>
              <p className='description-text'>{user.description}</p>
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
                {contactsList.map((contact, index) => (
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

          {isAuthenticated && (
            <div className='invite-place-container third-side'>
              <button 
                className='invite-button third-side' 
                onClick={() => setShowInviteForm(true)}>
                Пригласить
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'Активность' && (
        <div className='activity-tab'>
          <p className='activity-placeholder'>История активности пользователя</p>
        </div>
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