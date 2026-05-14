import './profile.scss'

import LockIcon from '@icons/lock.svg?react'
import HardSkills from '@icons/hard_skills.svg?react'
import SoftSkills from '@icons/soft_skillV2.svg?react'
import Contacts from '@icons/contacts.svg?react'
import Edit from '@icons/edit.svg?react'
import Delete from '@icons/delete.svg?react'
import Add from '@icons/plus.svg?react'
import Accept from '@icons/accept.svg?react'
import Reject from '@icons/reject.svg?react'
import ToggleOn from '@icons/toggle_on.svg?react'
import ToggleOff from '@icons/toggle_off.svg?react'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile'
import { profileApi } from '../services/profile'

import { ProfilePreview } from './profile_preview'
import type { UserProfileData } from '../hooks/useUserProfile'

// unauth profile
const UnauthorizedProfile = () => {
  return (
    <div className='profile-info-container'>
        <div className='info-container'>
            <LockIcon className='info-ico'/>
            <p className='info-comment'> Зарегистрируйтесь или войдите в аккаунт, чтобы управлять профилем</p>
        </div>
    </div>
  )
}

// auth profile
const AuthorizedProfile = () => {
  const [activeTab, setActiveTab] = useState('Информация');
  const [isPreview, setIsPreview] = useState(false);
  const { isAuthenticated } = useAuth();
  const { data: user, refresh } = useProfile(isAuthenticated); 

  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (user) {
      setFormData({
        nickname: user.nickname ?? '',
        realName: user.realName ?? '',
        age: user.age?.toString() ?? '',
        gender: user.gender ?? '',
        country: user.country ?? '',
        city: user.city ?? '',
        workplace: user.workplace ?? '',
        profileRole: user.profileRole ?? '',
        description: user.description ?? '',
        hardSkills: user.hardSkills ?? '',
        softSkills: user.softSkills ?? '',
        contacts: user.contacts ?? '',
        avatarUrl: user.avatarUrl ?? '',
      });
    }
  }, [user]);

  const hasChanges = useMemo(() => {
    if (!user) return false;
    
    const normalize = (val: any) => 
      val === null || val === undefined ? '' : String(val).trim();
    
    return Object.keys(formData).some(key => 
      normalize(formData[key]) !== normalize((user as any)[key])
    );
  }, [formData, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!hasChanges || !user) return;

    try {
      const changes: Record<string, any> = {};
      const normalize = (val: any) => val === null || val === undefined ? '' : String(val).trim();
      
      Object.keys(formData).forEach(key => {
        if (normalize(formData[key]) !== normalize((user as any)[key])) {
          changes[key] = formData[key];
        }
      });

      await profileApi.updateMe(changes);
      await refresh();
    } catch{}
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        nickname: user.nickname ?? '',
        realName: user.realName ?? '',
        age: user.age?.toString() ?? '',
        gender: user.gender ?? '',
        country: user.country ?? '',
        city: user.city ?? '',
        workplace: user.workplace ?? '',
        profileRole: user.profileRole ?? '',
        description: user.description ?? '',
        hardSkills: user.hardSkills ?? '',
        softSkills: user.softSkills ?? '',
        contacts: user.contacts ?? '',
        avatarUrl: user.avatarUrl ?? '',
      });
    }
  };

  return (
    <div className='profile-content-container'>
      <div className='tab-container'>
        <button className={`tab ${activeTab === 'Информация' ? 'active' : ''}`} onClick={() => setActiveTab('Информация')} >
          Информация
        </button>
        <button className={`tab ${activeTab === 'Активность' ? 'active' : ''}`} onClick={() => setActiveTab('Активность')}>
          Активность
        </button>
        <button className={`tab ${activeTab === 'Уведомления' ? 'active' : ''}`} onClick={() => setActiveTab('Уведомления')}>
          Уведомления
        </button>
        <button className={`tab ${activeTab === 'Настройки' ? 'active' : ''}`} onClick={() => setActiveTab('Настройки')}>
          Настройки
        </button>
      </div>

      {isPreview && user ? (
      <ProfilePreview user={user as UserProfileData} />
      ) : (
      <>
          <div className='profile-header-container'>
            <img className='profile-avatar' src={user?.avatarUrl} alt="Avatar" />
          <div className='profile-username-container'>
            <p className='username-label'>Имя пользователя: </p>
            <div className="username-input-container">
              <input className='username-input' name="nickname" value={formData.nickname} onChange={handleChange}/>
            </div>
          </div>
      </div>

      <div className='profile-body-field-container'>
        <div className='profile-field-container'>
          <p className='profile-field-text'> Реальное имя пользователя: </p>
          <input className='profile-field-input' name="realName" value={formData.realName} onChange={handleChange} />
        </div>

        <div className='profile-field-container'>
          <p className='profile-field-text'> Возраст: </p>
          <input className='profile-field-input' name="age" value={formData.age} onChange={handleChange} />
        </div>

        <div className='profile-field-container'>
          <p className='profile-field-text'> Пол: </p>
          <div className='profile-radio-container'>
            <label className='radio-text'>
            <input type="radio" name="gender" value="male" checked={formData.gender === 'male'} onChange={handleChange}/> 
              Мужской
            </label>
            <label className='radio-text'>
            <input type="radio" name="gender" value="female" checked={formData.gender === 'female'} onChange={handleChange}/> 
              Женский
            </label>
            <label className='radio-text'>
            <input type="radio" name="gender" value="unspecified" checked={formData.gender === 'unspecified'} onChange={handleChange}/> 
              Не указано
            </label>
          </div>
        </div>

        <div className='profile-field-container'>
          <p className='profile-field-text'> Страна: </p>
          <input className='profile-field-input' name="country" value={formData.country} onChange={handleChange} />
        </div>

        <div className='profile-field-container'>
          <p className='profile-field-text'> Город: </p>
          <input className='profile-field-input' name="city" value={formData.city} onChange={handleChange} />
        </div>

        <div className='profile-field-container'>
          <p className='profile-field-text'> Место учебы/работы: </p>
          <input className='profile-field-input' name="workplace" value={formData.workplace} onChange={handleChange} />
        </div>

        <div className='profile-field-container'>
          <p className='profile-field-text role'> Роль: </p>
          <input className='profile-field-input role' name="profileRole" value={formData.profileRole} onChange={handleChange} />
        </div>
        </div>

        <div className='profile-body-area-container'>
          <div className='profile-area-container'>
            <div className='profile-area-text-container'>
              <Edit className='profile-area-ico'/>
              <p className='profile-area-text'> Описание: </p>
            </div>
            <textarea className='profile-area-input description' name='description' value={formData.description} onChange={handleChange}></textarea>
          </div>

        <div className='profile-area-container'>
          <div className='profile-area-text-container'>
            <HardSkills className='profile-area-ico'/>
            <p className='profile-area-text'> Hard Skills: </p>
          </div>
          <textarea className='profile-area-input' name='hardSkills' placeholder='#python #django #sql' value={formData.hardSkills} onChange={handleChange}></textarea>
        </div>

        <div className='profile-area-container'>
          <div className='profile-area-text-container'>
            <SoftSkills className='profile-area-ico'/>
            <p className='profile-area-text'> Soft Skills: </p>
          </div>
          <textarea className='profile-area-input' name='softSkills' placeholder='#коммуникация #работа_в_команде #ответственность' value={formData.softSkills} onChange={handleChange}></textarea>
        </div>

        <div className='profile-area-container'>
          <div className='profile-area-text-container'>
            <Contacts className='profile-area-ico'/>
            <p className='profile-area-text'> Контакты: </p>
          </div>
          <button className='add-contact-button'>
            <Add className='add-contact-ico'/>
              Добавить контакт
          </button>
        </div>
      </div>
  </>
)}

      <div className='manage-container'>
        <button className='manage-button' disabled={!hasChanges} onClick={handleSave}>
          Сохранить
        </button>
        <button className='manage-button cancellation' disabled={!hasChanges} onClick={handleCancel}>
          Отмена
        </button>
        <div className='preview-toggle' onClick={() => setIsPreview(!isPreview) }>
          <p className='preview-label'> Предпросмотр</p>
            {isPreview ? (<ToggleOn className='preview-ico active' />) :
              (<ToggleOff className='preview-ico' />)}
        </div>
      </div>
    </div>
  )
}

export default function Profile () {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AuthorizedProfile /> : <UnauthorizedProfile />;
}