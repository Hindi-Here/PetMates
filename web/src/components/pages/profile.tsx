import './profile.scss'

import LockIcon from '@icons/lock.svg?react'
import UserDescription from '@icons/user_description.svg?react'
import HardSkills from '@icons/hard_skills.svg?react'
import SoftSkills from '@icons/soft_skills.svg?react'
import Contacts from '@icons/contacts.svg?react'
import Add from '@icons/plus.svg?react'
import Reject from '@icons/reject.svg?react'
import Delete from '@icons/delete.svg?react'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useChangeInput, validatorFormat, validatorRegex } from '../scripts/function'
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile'
import { profileApi } from '../services/profile'

import { Toggle } from '../common/toggle'

import { ProfilePreview } from './profile_preview'
import type { ThirdProfileData } from '../hooks/useThirdProfile'

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

  // validation rules (level 2)
  const validationRules = {
    nickname: validatorRegex.username,
    realName: (val: string) => validatorRegex.text(val, 100),
    age: validatorRegex.number,
    country: (val: string) => validatorRegex.text(val, 50),
    city: (val: string) => validatorRegex.text(val, 50),
    workplace: (val: string) => validatorRegex.text(val, 100),
    profileRole: validatorRegex.role,
    description: validatorRegex.message,
    hardSkills: validatorRegex.tags,
    softSkills: validatorRegex.tags,
  };

  const { data, touched, dirty, handleChange: handleValidationChange, handleBlur, reset } = useChangeInput(
  {
    nickname: '', 
    realName: '',
    age: '',
    country: '',
    city: '',
    workplace: '',
    profileRole: '',
    description: '',
    hardSkills: '',
    softSkills: '',
  },
    validationRules 
  );

  const [formData, setFormData] = useState<Record<string, any>>({});

  const normalizeValue = (name: string, value: string) => {
    const rule = validationRules[name as keyof typeof validationRules];
    return rule ? rule(value) : value;
  };

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
    try {
      const parsed = user.contacts ? JSON.parse(user.contacts) : [];
      if (Array.isArray(parsed)) {
        setContacts(parsed.map((c: any) => ({ 
          id: Date.now() + Math.random(), 
          label: c.name ?? c.label ?? '', 
          url: c.link ?? c.url ?? '',
          isNew: false
        })
      ));
      } 
      else {
        setContacts([]);
      }
    }
    catch {
      setContacts([]);
    }
  }}, [user]);

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
    const normalizedValue = normalizeValue(name, value);
    handleValidationChange(e);
    setFormData(prev => ({ ...prev, [name]: normalizedValue }));
  };

  const [isLoading, setIsLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false); 

  const handleSave = async () => {
    if (!hasChanges || !user) return;
      setIsLoading(true);
      setSaveError(null);
      setSaveSuccess(false);

    try {
      if (pendingAvatarFile) {
        const result = await profileApi.uploadAvatar(pendingAvatarFile);
        setFormData(prev => ({ ...prev, avatarUrl: result.avatarUrl }));
        setPendingAvatarFile(null);
      }

      const changes: Record<string, any> = {};
      const normalize = (val: any) => val === null || val === undefined ? '' : String(val).trim();

      Object.keys(formData).forEach(key => {
        if (key === 'avatarUrl') return;
        const newVal = normalize(formData[key]);
        const oldVal = normalize((user as any)[key]);
        if (newVal !== oldVal) {
          changes[key] = formData[key] === '' ? null : formData[key];
        }
      });

      if (Object.keys(changes).length > 0) {
        await profileApi.updateMe(changes);
      }

      await refresh();
      setSaveSuccess(true);
    }
    catch(err: any) {
      setSaveError(err.message || 'Ошибка сохранения');
    }
    finally {
    setIsLoading(false);
  }};

  const handleCancel = () => {
    if (user) {
      setPendingAvatarFile(null);
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
      try {
        const parsed = user.contacts ? JSON.parse(user.contacts) : [];
        setContacts(parsed.map((c: any) => ({ 
          id: Date.now() + Math.random(), 
          label: c.name ?? c.label ?? '', 
          url: c.link ?? c.url ?? '',
          isNew: false
        })
      ));
      }
      catch {
        setContacts([]);
      }
      reset();
    }};

  interface ContactItem {
    id: number;
    label: string;
    url: string;
    isNew: boolean;
  }

  // contacts manage
  const [contacts, setContacts] = useState<ContactItem[]>([]);

  const addContact = () => {
    setContacts(prev => [...prev, { id: Date.now(), label: '', url: '', isNew: true }]);
  };

  const removeContact = (id: number) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const updateContact = (id: number, field: 'label' | 'url', value: string) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  useEffect(() => {
    try {
      const serialized = JSON.stringify(contacts.map(c => ({ name: c.label, link: c.url })));
      setFormData(prev => ({ ...prev, contacts: serialized }));
    } catch {}
  }, [contacts]);

  // validate level 1
  const isFormValid = useMemo(() => {
    const fields = ['nickname', 'realName', 'age', 'country', 'city', 
                  'workplace', 'profileRole', 'description', 'hardSkills', 'softSkills'];
  
    const fieldsValid = fields.every(field => checkFormat(field, formData[field] ?? '') === null);
  
    const contactsValid = contacts.every(c => !c.isNew || (c.label.trim() && c.url.trim()));

    return fieldsValid && contactsValid;
  }, [formData, contacts]);

  // avatar update
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file)
      return;

    const localUrl = URL.createObjectURL(file);
    setFormData(prev => ({ ...prev, avatarUrl: localUrl }));
    setPendingAvatarFile(file);
    e.target.value = '';
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
      <ProfilePreview user={user as ThirdProfileData} />
      ) : (
      <>
        <div className='profile-header-container'>
          <div className='profile-avatar-wrapper' onClick={handleAvatarClick}>
            <img className='profile-avatar' src={formData.avatarUrl || '/default-avatar.png'} alt="Avatar" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
          </div>
        <div className='profile-username-container'>
          <p className='username-label'>Имя пользователя: </p>
          <div className="username-input-container">
            <input className={`username-input ${touched.nickname && dirty.nickname && checkFormat('nickname', data.nickname) ? 'input-error' : ''}`} name="nickname" maxLength={50} value={formData.nickname} onChange={handleChange} onBlur={handleBlur}/>
          </div>
        </div>
      </div>

      <div className='profile-body-field-container'>

        <div className='profile-field-container'>
          <p className='profile-field-text'> Реальное имя пользователя: </p>
          <input className={`profile-field-input ${touched.realName && dirty.realName && checkFormat('realName', data.realName) ? 'input-error' : ''}`} name="realName" maxLength={100} value={formData.realName} onChange={handleChange} onBlur={handleBlur}/>
        </div>

        <div className='profile-field-container'>
          <p className='profile-field-text'> Возраст: </p>
          <input className={`profile-field-input ${touched.age && dirty.age && checkFormat('age', data.age) ? 'input-error' : ''}`} name="age" value={formData.age} onChange={handleChange} onBlur={handleBlur}/>
        </div>

        <div className='profile-field-container'>
          <p className='profile-field-text'> Пол: </p>
          <div className='profile-radio-container'>
            <label className='radio-text'>
            <input type="radio" name="gender" value="male" checked={formData.gender === 'male'} onChange={handleChange} onBlur={handleBlur}/> 
              Мужской
            </label>
            <label className='radio-text'>
            <input type="radio" name="gender" value="female" checked={formData.gender === 'female'} onChange={handleChange} onBlur={handleBlur}/> 
              Женский
            </label>
            <label className='radio-text'>
            <input type="radio" name="gender" value="unspecified" checked={formData.gender === 'unspecified'} onChange={handleChange} onBlur={handleBlur}/> 
              Не указано
            </label>
          </div>
        </div>

        <div className='profile-field-container'>
          <p className='profile-field-text'> Страна: </p>
          <input className={`profile-field-input ${touched.country && dirty.country && checkFormat('country', data.country) ? 'input-error' : ''}`} name="country" maxLength={50} value={formData.country} onChange={handleChange} onBlur={handleBlur}/>
        </div>

        <div className='profile-field-container'>
          <p className='profile-field-text'> Город: </p>
          <input className={`profile-field-input ${touched.city && dirty.city && checkFormat('city', data.city) ? 'input-error' : ''}`} name="city" maxLength={50} value={formData.city} onChange={handleChange} onBlur={handleBlur}/>
        </div>

        <div className='profile-field-container'>
          <p className='profile-field-text'> Место учебы/работы: </p>
          <input className={`profile-field-input ${touched.workplace && dirty.workplace && checkFormat('workplace', data.workplace) ? 'input-error' : ''}`} name="workplace" maxLength={100} value={formData.workplace} onChange={handleChange} onBlur={handleBlur}/>
        </div>

        <div className='profile-field-container'>
          <p className='profile-field-text role'> Роль: </p>
          <input className={`profile-field-input role ${touched.profileRole && dirty.profileRole && checkFormat('profileRole', data.profileRole) ? 'input-error' : ''}`} name="profileRole" maxLength={50} value={formData.profileRole} onChange={handleChange} onBlur={handleBlur}/>
        </div>
      </div>

      <div className='profile-body-area-container'>
        <div className='profile-area-container'>
          <div className='profile-area-text-container'>
            <UserDescription className='profile-area-ico'/>
            <div className='profile-area-text-wrapper'>
              <p className='profile-area-text'> Описание: </p>
              <p className={`char-counter ${(formData.description?.length ?? 0) >= 2000 ? 'limit' : ''}`}>
                {formData.description?.length ?? 0} / 2000
              </p>
            </div>
          </div>
          <textarea className={`profile-area-input description ${touched.description && dirty.description && checkFormat('description', data.description) ? 'input-error' : ''}`} name='description' value={formData.description} onChange={handleChange} onBlur={handleBlur}></textarea>
        </div>

        <div className='profile-area-container'>
          <div className='profile-area-text-container'>
            <HardSkills className='profile-area-ico'/>
            <p className='profile-area-text'> Hard Skills: </p>
          </div>
          <textarea className={`profile-area-input ${touched.hardSkills && dirty.hardSkills && checkFormat('hardSkills', data.hardSkills) ? 'input-error' : ''}`} name='hardSkills' maxLength={250} placeholder='#python #django #sql' value={formData.hardSkills} onChange={handleChange} onBlur={handleBlur}></textarea>
        </div>

        <div className='profile-area-container'>
          <div className='profile-area-text-container'>
            <SoftSkills className='profile-area-ico'/>
            <p className='profile-area-text'> Soft Skills: </p>
          </div>
          <textarea className={`profile-area-input ${touched.softSkills && dirty.softSkills && checkFormat('softSkills', data.softSkills) ? 'input-error' : ''}`} name='softSkills' maxLength={250} placeholder='#коммуникация #работа_в_команде #ответственность' value={formData.softSkills} onChange={handleChange} onBlur={handleBlur}></textarea>
        </div>

        <div className='profile-area-container'>
          <div className='profile-area-text-container'>
            <Contacts className='profile-area-ico'/>
            <p className='profile-area-text'> Контакты: </p>
          </div>

          <div className='contacts-list'>
          {contacts.map(contact => (
          <div key={contact.id} className='contact-item'>
            <input className='contact-input label' placeholder='Название' value={contact.label} onChange={e => updateContact(contact.id, 'label', e.target.value)}/>
            <input className='contact-input url' placeholder='Ссылка' value={contact.url} onChange={e => updateContact(contact.id, 'url', e.target.value)}/>
    
            {contact.isNew ? (
            <>
              <button className='contact-action reject' onClick={() => removeContact(contact.id)}>
              <Reject className='contact-action-ico'/>
              </button>
            </>
            ) : (
              <button className='contact-action reject' onClick={() => removeContact(contact.id)}>
              <Delete className='contact-action-ico'/>
              </button>
            )}
            </div>
            ))}
          </div>
          <button className='add-contact-button' onClick={addContact}>
            <Add className='add-contact-ico'/> Добавить контакт
          </button>
        </div>
      </div>
      </>
      )}
      <div className='manage-container'>
        <button className='manage-button' onClick={handleSave} disabled={!hasChanges || !isFormValid || isLoading} >
          Сохранить
        </button>
        <button className='manage-button cancellation' disabled={!hasChanges} onClick={handleCancel}>
          Отмена
        </button>
        <div className='preview-group'>
          <p className='preview-label'> Предпросмотр</p>
          <Toggle checked={isPreview} onChange={setIsPreview}/>
        </div>
      </div>
      {saveError && <p className='save-error-text'>{saveError}</p>}
      {saveSuccess && <p className='save-success-text'>Профиль успешно обновлён</p>}
    </div>
  )
}

export default function Profile () {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AuthorizedProfile /> : <UnauthorizedProfile />;
}

// check valide field (level 1)
  const checkFormat = (fieldName: string, value: string): string | null => {
    const rules: Record<string, Array<[boolean, string]>> = {
      nickname: [
        [!validatorFormat.required(value), 'Введите никнейм'],
        [!validatorFormat.maxLength(value, 50), 'Максимум 50 символов']
      ],
      realName: [
        [!validatorFormat.maxLength(value, 100), 'Максимум 100 символов']
      ],
      age: [
        [value.length > 0 && !validatorFormat.number(value), 'Возраст должен содержать только цифры']
      ],
      country: [
        [!validatorFormat.maxLength(value, 50), 'Максимум 50 символов']
      ],
      city: [
        [!validatorFormat.maxLength(value, 50), 'Максимум 50 символов']
      ],
      workplace: [
        [!validatorFormat.maxLength(value, 100), 'Максимум 100 символов']
      ],
      profileRole: [
        [!validatorFormat.required(value), 'Введите роль'],
        [!validatorFormat.maxLength(value, 50), 'Максимум 50 символов']
      ],
      description: [
        [!validatorFormat.maxLength(value, 2000), 'Максимум 2000 символов']
      ],
      hardSkills: [
        [value.length > 0 && !validatorFormat.hasTag(value), 'Теги должны начинаться с # и содержать только буквы, цифры и _']
      ],
      softSkills: [
        [value.length > 0 && !validatorFormat.hasTag(value), 'Теги должны начинаться с # и содержать только буквы, цифры и _']
      ],
    };

    const fieldRules = rules[fieldName as keyof typeof rules];
    if (!fieldRules) return null;

    const error = fieldRules.find(([isInvalid]) => isInvalid);
    return error?.[1] ?? null;
  };