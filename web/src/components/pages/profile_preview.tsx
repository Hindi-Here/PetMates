import HardSkills from '@icons/hard_skills.svg?react'
import SoftSkills from '@icons/soft_skillV2.svg?react'
import Contacts from '@icons/contacts.svg?react'
import Edit from '@icons/edit.svg?react'

import type { UserProfileData } from '../hooks/useUserProfile'

interface ProfilePreviewProps {
  user: UserProfileData
}

export const ProfilePreview = ({ user }: ProfilePreviewProps) => {
  const contactsList: Array<{name: string, link: string}> = (() => {
    try {
      return user.contacts ? JSON.parse(user.contacts) : []
    } catch {
      return []
    }
  })()

  const normalizeSkills = (value: string | string[] | undefined): string[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      return value.split(/\s+/).filter(t => t.startsWith('#')).map(t => t.replace(/^#/, ''));
    }
    return [];
  };

  const hardSkills = normalizeSkills(user.hardSkills);
  const softSkills = normalizeSkills(user.softSkills);

  return (
    <>
      <div className='profile-header-container'>
        <img 
          className='profile-avatar' 
          src={user.avatarUrl || '/default-avatar.png'} 
          alt={user.nickname} 
        />
        <div className='profile-username-container'>
          <div className='username-main'>
            <p className='username'>{user.nickname}</p>
            {user.realName && <p className='real-name'>({user.realName})</p>}
          </div>
          <p className='profile-role'>{user.profileRole}</p>
          
          <div className='online-container'>
            <div className='circle-online'></div> 
            <p className='online-text'>Онлайн</p>   
          </div>
        </div>
      </div>

      <div className='profile-meta-container'>
        {[
          { label: 'Страна', value: user.country },
          { label: 'Город', value: user.city },
          { label: 'Место учебы/работы', value: user.workplace },
          { label: 'Возраст', value: user.age ? `${user.age} лет` : null },
          { label: 'Пол', value: user.gender === 'male' ? 'Мужской' : user.gender === 'female' ? 'Женский' : null }
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
            <Edit className='profile-area-ico' />
            <p className='profile-area-text'>Описание:</p>
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
          {hardSkills.length > 0 ? (
            hardSkills.map((skill, index) => (
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
          {softSkills.length > 0 ? (
            softSkills.map((skill, index) => (
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
                <a href={contact.link} className='contact-link' target="_blank" rel="noopener noreferrer">
                  {contact.link}
                </a>
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
  )
}