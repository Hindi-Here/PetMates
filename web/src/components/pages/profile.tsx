import './profile.scss'
import { useNavigate, useLocation, useParams, Navigate } from 'react-router-dom'
import LockIcon from '@icons/lock.svg?react'
import Add from '@icons/plus.svg?react'
import Reject from '@icons/reject.svg?react'
import Delete from '@icons/delete.svg?react'
import { Activity } from './activity'
import { Notifications } from './notification'
import { Setting } from './setting'
import { Project } from './project'
import ProjectViewer from './project_viewer'
import ProfileViewer from './profile_viewer'
import { ProfilePublicView, type ProfilePublicData } from './profile_public_view'
import { useEffect, useMemo, useState, useRef } from 'react'
import { projectsApi } from '../services/project'
import { useChangeInput, validatorFormat, validatorRegex } from '../scripts/function'
import { useAuth } from '../hooks/useAuth'
import { useProfile, type ProfileData } from '../hooks/useProfile'
import { profileApi } from '../services/profile'
import { Toggle } from '../common/toggle'
import { Responses } from './response'
import { Messages } from './message'
import { Chat } from './chat'
import { EventPage } from './events/event_page'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LIMITS, TIMING} from '../scripts/limits'
import { invalidateProfile } from '../scripts/query/invalidate'
import { queryKeys } from '../scripts/query/queryKeys'
import { STALE } from '../scripts/query/queryClient'

interface ProfileFormData {
  nickname: string
  realName: string
  age: string
  gender: string
  country: string
  city: string
  workplace: string
  profileRole: string
  description: string
  hardSkills: string
  softSkills: string
  contacts: string
  avatarUrl: string
}

interface ContactItem {
  id: number
  label: string
  url: string
  isNew: boolean
}

const UnauthorizedProfile = () => {
  return (
    <div className='profile-info-container'>
      <div className='info-container'>
        <LockIcon className='info-ico'/>
        <p className='info-comment'> Зарегистрируйтесь или войдите в аккаунт, чтобы управлять своим профилем </p>
      </div>
    </div>
  )
}

const AuthorizedProfile = () => {
  const [isPreview, setIsPreview] = useState(false)
  const { isAuthenticated, userId } = useAuth()
  const { profileId } = useParams<{ profileId: string }>()
  const profileKey = profileId || userId
  const queryClient = useQueryClient()
  const { data: user } = useProfile(isAuthenticated)
  
  const tabRoutes: Record<string, string> = {
    'Информация': 'info',
    'Активность': 'activity',
    'Отклики': 'responces',
    'Сообщения': 'messages',
    'Уведомления': 'notifications',
    'Настройки': 'settings',
  }
  
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname
  const prefix = profileKey ? `/profile/${profileKey}` : '/profile'
  
  const isProjectRoute = currentPath === `${prefix}/activity/project` || currentPath.startsWith(`${prefix}/activity/project/`)
  const isEventRoute = currentPath === `${prefix}/activity/event` || currentPath.startsWith(`${prefix}/activity/event/`)
  const isActivityRoute = currentPath === `${prefix}/activity` || currentPath.startsWith(`${prefix}/activity/`)
  const isResponsesRoute = currentPath === `${prefix}/responces` || currentPath.startsWith(`${prefix}/responces/`)
  const isNotificationsRoute = currentPath.startsWith(`${prefix}/notifications`)
  const isSettingsRoute = currentPath.startsWith(`${prefix}/settings`)
  const isChatRoute = currentPath !== `${prefix}/messages` && currentPath.startsWith(`${prefix}/messages/`)
  const isMessagesRoute = currentPath === `${prefix}/messages` || currentPath.startsWith(`${prefix}/messages/`)
  
  const activeTab = isResponsesRoute
    ? 'Отклики'
    : isMessagesRoute
    ? 'Сообщения'
    : isNotificationsRoute
    ? 'Уведомления'
    : isSettingsRoute
    ? 'Настройки'
    : isProjectRoute || isActivityRoute
    ? 'Активность'
    : 'Информация'
  
  const validationRules = {
    nickname: validatorRegex.username,
    realName: (val: string) => validatorRegex.text(val, LIMITS.profile.realNameMax),
    age: validatorRegex.number,
    country: (val: string) => validatorRegex.text(val, LIMITS.profile.countryMax),
    city: (val: string) => validatorRegex.text(val, LIMITS.profile.cityMax),
    workplace: (val: string) => validatorRegex.text(val, LIMITS.profile.workplaceMax),
    profileRole: validatorRegex.role,
    description: validatorRegex.message,
    hardSkills: validatorRegex.tags,
    softSkills: validatorRegex.tags,
  }
  
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
  )
  
  const [formData, setFormData] = useState<ProfileFormData>({
    nickname: '',
    realName: '',
    age: '',
    gender: '',
    country: '',
    city: '',
    workplace: '',
    profileRole: '',
    description: '',
    hardSkills: '',
    softSkills: '',
    contacts: '',
    avatarUrl: '',
  })
  
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
      })
      try {
        const parsed = user.contacts ? JSON.parse(user.contacts) : []
        if (Array.isArray(parsed)) {
          setContacts(parsed.map((c: { name?: string; label?: string; link?: string; url?: string }) => ({
            id: Date.now() + Math.random(),
            label: c.name ?? c.label ?? '',
            url: c.link ?? c.url ?? '',
            isNew: false
          })))
        } else {
          setContacts([])
        }
      } catch {
        setContacts([])
      }
    }
  }, [user])
  
  const hasChanges = useMemo(() => {
    if (!user) return false
    const normalize = (val: unknown) =>
      val === null || val === undefined ? '' : String(val).trim()
    return Object.keys(formData).some(key =>
      normalize(formData[key as keyof ProfileFormData]) !== normalize((user as Record<string, unknown>)[key])
    )
  }, [formData, user])
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    handleValidationChange(e)
  }
  
  const [isLoading, setIsLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  const handleSave = async () => {
    if (!hasChanges || !user) return
    setIsLoading(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      if (pendingAvatarDelete) {
        await profileApi.deleteAvatar()
        setPendingAvatarDelete(false)
      } else if (pendingAvatarFile) {
        const result = await profileApi.uploadAvatar(pendingAvatarFile)
        setFormData(prev => ({ ...prev, avatarUrl: result.avatarUrl }))
        setPendingAvatarFile(null)
      }
      const changes: Record<string, string | number | boolean | null> = {}
      const normalize = (val: unknown) => val === null || val === undefined ? '' : String(val).trim()
      Object.keys(formData).forEach(key => {
        if (key === 'avatarUrl') return
        const newVal = normalize(formData[key as keyof ProfileFormData])
        const oldVal = normalize((user as Record<string, unknown>)[key])
        if (newVal !== oldVal) {
          const value = formData[key as keyof ProfileFormData]
          if (key === 'age') {
            changes[key] = value === '' ? null : Number(value)
          } else {
            changes[key] = value === '' ? null : value
          }
        }
      })
      if (Object.keys(changes).length > 0) {
        await profileApi.updateMe(changes as unknown as ProfileData)
      }
      await invalidateProfile(queryClient)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), TIMING.toastMs)
    }
    catch (err: any) {
      setSaveError(err.message || 'Ошибка сохранения')
      setTimeout(() => setSaveError(null), TIMING.toastMs)
    }
    finally {
      setIsLoading(false)
    }
  }
  
  const handleCancel = () => {
    if (user) {
      setPendingAvatarDelete(false)
      setPendingAvatarFile(null)
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
      })
      try {
        const parsed = user.contacts ? JSON.parse(user.contacts) : []
        setContacts(parsed.map((c: { name?: string; label?: string; link?: string; url?: string }) => ({
          id: Date.now() + Math.random(),
          label: c.name ?? c.label ?? '',
          url: c.link ?? c.url ?? '',
          isNew: false
        })))
      }
      catch {
        setContacts([])
      }
      reset()
    }
  }
  
  const [contacts, setContacts] = useState<ContactItem[]>([])

  const previewUser = useMemo(() => {
    if (!user) return null
    return {
      ...user,
      nickname: formData.nickname,
      realName: formData.realName,
      age: formData.age ? Number(formData.age) : undefined,
      gender: formData.gender,
      country: formData.country,
      city: formData.city,
      workplace: formData.workplace,
      profileRole: formData.profileRole,
      description: formData.description,
      hardSkills: formData.hardSkills,
      softSkills: formData.softSkills,
      avatarUrl: formData.avatarUrl,
      contacts: JSON.stringify(
        contacts
          .filter(c => c.label.trim() && c.url.trim())
          .map(c => ({ name: c.label, link: c.url }))
      ),
    } as unknown as ProfilePublicData
  }, [user, formData, contacts])
  
  const addContact = () => {
    setContacts(prev => prev.length >= LIMITS.profile.contactsMax
      ? prev
      : [...prev, { id: Date.now(), label: '', url: '', isNew: true }])
  }
  
  const removeContact = (id: number) => {
    setContacts(prev => prev.filter(c => c.id !== id))
  }
  
  const updateContact = (id: number, field: 'label' | 'url', value: string) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }
  
  useEffect(() => {
    try {
      const serialized = JSON.stringify(contacts.map(c => ({ name: c.label, link: c.url })))
      setFormData(prev => ({ ...prev, contacts: serialized }))
    } catch {}
  }, [contacts])
  
  const isFormValid = useMemo(() => {
    const fields = ['nickname', 'realName', 'age', 'country', 'city',
      'workplace', 'profileRole', 'description', 'hardSkills', 'softSkills']
    const fieldsValid = fields.every(field => checkFormat(field, formData[field as keyof ProfileFormData] ?? '') === null)

    const contactsValid =
      contacts.length <= LIMITS.profile.contactsMax &&
      contacts.every(c =>
        c.label.trim() && c.url.trim() &&
        c.label.length <= LIMITS.profile.contactNameMax &&
        c.url.length <= LIMITS.profile.contactUrlMax)

    return fieldsValid && contactsValid
  }, [formData, contacts])
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)

  const [pendingAvatarDelete, setPendingAvatarDelete] = useState(false)

  const handleAvatarRemove = () => {
    setPendingAvatarFile(null)
    setPendingAvatarDelete(!!user?.avatarUrl)
    setFormData(prev => ({ ...prev, avatarUrl: '' }))
  }
  
  const handleAvatarClick = () => fileInputRef.current?.click()
  
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > LIMITS.upload.avatarMaxBytes) {
      setSaveError(`Максимальный размер аватара ${LIMITS.upload.avatarMaxBytes / 1024 / 1024} МБ`)
      setTimeout(() => setSaveError(null), TIMING.toastMs)
      e.target.value = ''
      return
    }
    const localUrl = URL.createObjectURL(file)
    setFormData(prev => ({ ...prev, avatarUrl: localUrl }))
    setPendingAvatarDelete(false)
    setPendingAvatarFile(file)
    e.target.value = ''
  }
  
  const isThirdParty = profileId && profileId !== userId
  const protectedTabs = ['Отклики', 'Сообщения', 'Уведомления', 'Настройки']
  const isBlockedThirdPartyTab = Boolean(isThirdParty) && protectedTabs.includes(activeTab)
  
  useEffect(() => {
    if (isBlockedThirdPartyTab && userId) {
      navigate(`/profile/${userId}/${tabRoutes[activeTab]}`, { replace: true })
    }
  }, [isBlockedThirdPartyTab, activeTab, userId])
  
  if (isBlockedThirdPartyTab) {
    return null
  }
  
  return (
    <div className='profile-content-container'>
      <div className='tab-wrapper'>
        <div className='tab-container'>
          {(isThirdParty
            ? ['Информация', 'Активность']
            : ['Информация', 'Активность', 'Отклики', 'Сообщения', 'Уведомления', 'Настройки']
          ).map(tab => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => navigate(`${prefix}/${tabRoutes[tab]}`)}>
              {tab}
            </button>
          ))}
        </div>
      </div>
      
      {activeTab === 'Информация' && !isProjectRoute && (
        isThirdParty ? (
          <ProfileViewer />
          ) : isPreview && previewUser ? (
            <ProfilePublicView user={previewUser} isPreview />
          ) : (
          <>
           <div className='profile-header-container'>
              <div className='profile-avatar-wrapper'>
                <div onClick={handleAvatarClick}>
                  {!user ? (
                    <div className='avatar-skeleton' />
                  ) : (
                    <img className='profile-avatar' src={formData.avatarUrl || '/default-avatar.png'} />
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleAvatarChange} />
                </div>
                {formData.avatarUrl && (
                  <button type='button' className='avatar-remove-link' onClick={handleAvatarRemove}>
                    Удалить
                  </button>
                )}
              </div>
              <div className='profile-username-container'>
                <p className='username-label'>Имя пользователя: </p>
                <div className="username-input-container">
                  <input 
                    className={`username-input ${touched.nickname && dirty.nickname && checkFormat('nickname', data.nickname) ? 'input-error' : ''}`} 
                    name="nickname" 
                    maxLength={LIMITS.profile.nicknameMax} 
                    value={formData.nickname ?? ''}
                    onChange={handleChange} 
                    onBlur={handleBlur} />
                </div>
              </div>
            </div>
            
            <div className='profile-body-field-container'>
              <div className='profile-field-container'>
                <p className='profile-field-text'> Реальное имя пользователя: </p>
                <input 
                  className={`profile-field-input ${touched.realName && dirty.realName && checkFormat('realName', data.realName) ? 'input-error' : ''}`} 
                  name="realName" 
                  maxLength={LIMITS.profile.realNameMax} 
                  value={formData.realName ?? ''}
                  onChange={handleChange} 
                  onBlur={handleBlur} />
              </div>
              
              <div className='profile-field-container'>
                <p className='profile-field-text'> Возраст: </p>
                <input 
                  className={`profile-field-input ${touched.age && dirty.age && checkFormat('age', data.age) ? 'input-error' : ''}`} 
                  name="age"
                  maxLength={3} 
                  value={formData.age ?? ''}
                  onChange={handleChange} 
                  onBlur={handleBlur} />
              </div>
              
              <div className='profile-field-container'>
                <p className='profile-field-text'> Пол: </p>
                <div className='profile-radio-container'>
                  <label className='radio-text'>
                    <input type="radio" name="gender" value="male" checked={formData.gender === 'male'} onChange={handleChange} onBlur={handleBlur} />
                    Мужской
                  </label>
                  <label className='radio-text'>
                    <input type="radio" name="gender" value="female" checked={formData.gender === 'female'} onChange={handleChange} onBlur={handleBlur} />
                    Женский
                  </label>
                  <label className='radio-text'>
                    <input type="radio" name="gender" value="unspecified" checked={formData.gender === 'unspecified'} onChange={handleChange} onBlur={handleBlur} />
                    Не указано
                  </label>
                </div>
              </div>
              
              <div className='profile-field-container'>
                <p className='profile-field-text'> Страна: </p>
                <input 
                  className={`profile-field-input ${touched.country && dirty.country && checkFormat('country', data.country) ? 'input-error' : ''}`} 
                  name="country" 
                  maxLength={LIMITS.profile.countryMax} 
                  value={formData.country ?? ''}
                  onChange={handleChange} 
                  onBlur={handleBlur}  />
              </div>
              
              <div className='profile-field-container'>
                <p className='profile-field-text'> Город: </p>
                <input 
                  className={`profile-field-input ${touched.city && dirty.city && checkFormat('city', data.city) ? 'input-error' : ''}`} 
                  name="city" 
                  maxLength={LIMITS.profile.cityMax} 
                  value={formData.city ?? ''}
                  onChange={handleChange} 
                  onBlur={handleBlur}  />
              </div>
              
              <div className='profile-field-container'>
                <p className='profile-field-text'> Место учебы/работы: </p>
                <input 
                  className={`profile-field-input ${touched.workplace && dirty.workplace && checkFormat('workplace', data.workplace) ? 'input-error' : ''}`} 
                  name="workplace" 
                  maxLength={LIMITS.profile.workplaceMax} 
                  value={formData.workplace ?? ''}
                  onChange={handleChange} 
                  onBlur={handleBlur}  />
              </div>
              
              <div className='profile-field-container'>
                <p className='profile-field-text role'> Роль: </p>
                <input 
                  className={`profile-field-input role ${touched.profileRole && dirty.profileRole && checkFormat('profileRole', data.profileRole) ? 'input-error' : ''}`} 
                  name="profileRole" 
                  maxLength={LIMITS.profile.roleMax} 
                  value={formData.profileRole ?? ''}
                  onChange={handleChange} 
                  onBlur={handleBlur}  />
              </div>
            </div>
            
            <div className='profile-body-area-container'>
              <div className='profile-area-container'>
                <div className='profile-area-text-container'>
                  <div className='profile-area-text-wrapper'>
                    <p className='profile-area-text'> Описание: </p>
                    <p className={`char-counter ${(formData.description?.length ?? 0) >= LIMITS.profile.descriptionMax ? 'limit' : ''}`}>
                      {formData.description?.length ?? 0} / {LIMITS.profile.descriptionMax}
                    </p>
                  </div>
                </div>
                <textarea 
                  className={`profile-area-input description ${touched.description && dirty.description && checkFormat('description', data.description) ? 'input-error' : ''}`} 
                  name='description' 
                  value={formData.description ?? ''}
                  onChange={handleChange} 
                  onBlur={handleBlur}
                  placeholder={'### Обо мне\n\nРасскажите о себе, своих интересах и опыте.\n\n**Навыки:**\n- Язык программирования / технология\n- Инструменты и фреймворки\n- Soft skills\n\n**Цели:**\n- Чему хотите научиться\n- Какие проекты интересны\n\n**Контакты:**\n- Telegram / Email / GitHub'}/>
              </div>
              
              <div className='profile-area-container'>
                <div className='profile-area-text-container'>
                  <p className='profile-area-text'> Hard Skills: </p>
                </div>
                <textarea 
                  className={`profile-area-input ${touched.hardSkills && dirty.hardSkills && checkFormat('hardSkills', data.hardSkills) ? 'input-error' : ''}`} 
                  name='hardSkills' 
                  maxLength={LIMITS.profile.skillsMax} 
                  placeholder='#python #django #sql' 
                  value={formData.hardSkills ?? ''}
                  onChange={handleChange} 
                  onBlur={handleBlur}/>
              </div>
              
              <div className='profile-area-container'>
                <div className='profile-area-text-container'>
                  <p className='profile-area-text'> Soft Skills: </p>
                </div>
                <textarea 
                  className={`profile-area-input ${touched.softSkills && dirty.softSkills && checkFormat('softSkills', data.softSkills) ? 'input-error' : ''}`} 
                  name='softSkills' 
                  maxLength={LIMITS.profile.skillsMax} 
                  placeholder='#коммуникация #работа_в_команде #ответственность' 
                  value={formData.softSkills ?? ''}
                  onChange={handleChange} 
                  onBlur={handleBlur}/>
              </div>
              
              <div className='profile-area-container'>
                <div className='profile-area-text-container'>
                  <p className='profile-area-text'> Контакты: </p>
                </div>
                <div className='contacts-list'>
                  {contacts.map(contact => (
                    <div key={contact.id} className='contact-item'>
                      <input className='contact-input label' placeholder='Название' value={contact.label} onChange={e => updateContact(contact.id, 'label', e.target.value)} maxLength={LIMITS.profile.contactNameMax}/>
                      <input className='contact-input url' placeholder='Ссылка' value={contact.url} onChange={e => updateContact(contact.id, 'url', e.target.value)} maxLength={LIMITS.profile.contactUrlMax} />
                      {contact.isNew ? (
                        <>
                          <button className='contact-action reject' onClick={() => removeContact(contact.id)}>
                            <Reject className='contact-action-ico' />
                          </button>
                        </>
                      ) : (
                        <button className='contact-action reject' onClick={() => removeContact(contact.id)}>
                          <Delete className='contact-action-ico' />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button className='add-contact-button' onClick={addContact}>
                  <Add className='add-contact-ico' /> Добавить контакт
                </button>
              </div>
            </div>
          </>
        )
      )}
      
      {activeTab === 'Активность' && (
        isProjectRoute ? (
          <ProjectOrThirdSide />
        ) : isEventRoute ? (
          <EventPage />
        ) : (
          <Activity />
        )
      )}
      
      {!isThirdParty && (
        <>
          {activeTab === 'Отклики' && <Responses />}
          {activeTab === 'Сообщения' && (isChatRoute ? <Chat /> : <Messages />)}
          {activeTab === 'Уведомления' && <Notifications />}
          {activeTab === 'Настройки' && <Setting />}
        </>
      )}
      
      {!isThirdParty && !isProjectRoute && activeTab === 'Информация' && (
        <div className='manage-container'>
          <button className='manage-button' onClick={handleSave} disabled={!hasChanges || !isFormValid || isLoading} >
            Сохранить
          </button>
          <button className='manage-button cancellation' disabled={!hasChanges} onClick={handleCancel}>
            Отмена
          </button>
          <div className='preview-group'>
            <p className='preview-label'> Предпросмотр</p>
            <Toggle checked={isPreview} onChange={setIsPreview} />
          </div>
        </div>
      )}
      
      {!isThirdParty && !isProjectRoute && activeTab === 'Информация' && (
        <>
          {saveError && (<p className='save-error-text message-auto-hide' onAnimationEnd={() => setSaveError(null)}>
            {saveError}
          </p>)}
          {saveSuccess && (<p className='save-success-text message-auto-hide' onAnimationEnd={() => setSaveSuccess(false)}>
            Профиль успешно обновлен
          </p>)}
        </>
      )}
    </div>
  )
}

const ProjectOrThirdSide = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const { userId } = useAuth()

  const { data: project, isLoading } = useQuery({
    queryKey: queryKeys.projects.byId(projectId!),
    queryFn: () => projectsApi.getProject(projectId!),
    enabled: !!projectId,
    staleTime: STALE.short,
  })

  if (isLoading) return <div className='project-page' />

  return project && project.ownerId === userId ? <Project /> : <ProjectViewer />
}

export default function Profile() {
  const { profileId } = useParams<{ profileId: string }>()
  const { isAuthenticated, userId } = useAuth()
  
  if (!profileId) {
    if (isAuthenticated && userId) {
      return <Navigate to={`/profile/${userId}/info`} replace />
    }
    return isAuthenticated ? <AuthorizedProfile /> : <UnauthorizedProfile />
  }
  
  const isThirdParty = profileId !== userId
  
  if (isThirdParty || isAuthenticated) {
    return <AuthorizedProfile />
  }
  
  return <UnauthorizedProfile />
}

const checkFormat = (fieldName: string, value: string): string | null => {
  const rules: Record<string, Array<[boolean, string]>> = {
    nickname: [
      [!validatorFormat.required(value), 'Введите никнейм'],
      [!validatorFormat.minLength(value, LIMITS.profile.nicknameMin), `Минимум ${LIMITS.profile.nicknameMin} символа`],
      [!validatorFormat.maxLength(value, LIMITS.profile.nicknameMax), `Максимум ${LIMITS.profile.nicknameMax} символов`]
    ],
    realName: [
      [!validatorFormat.maxLength(value, LIMITS.profile.realNameMax), `Максимум ${LIMITS.profile.realNameMax} символов`]
    ],
    age: [
      [value.length > 0 && !validatorFormat.number(value), 'Возраст должен содержать только цифры'],
      [value.length > 0 && (Number(value) < LIMITS.profile.ageMin || Number(value) > LIMITS.profile.ageMax),
        `Допустимо от ${LIMITS.profile.ageMin} до ${LIMITS.profile.ageMax}`]
    ],
    country: [
      [!validatorFormat.maxLength(value, LIMITS.profile.countryMax), `Максимум ${LIMITS.profile.countryMax} символов`]
    ],
    city: [
      [!validatorFormat.maxLength(value, LIMITS.profile.cityMax), `Максимум ${LIMITS.profile.cityMax} символов`]
    ],
    workplace: [
      [!validatorFormat.maxLength(value, LIMITS.profile.workplaceMax), `Максимум ${LIMITS.profile.workplaceMax} символов`]
    ],
    profileRole: [
      [!validatorFormat.required(value), 'Введите роль'],
      [!validatorFormat.maxLength(value, LIMITS.profile.roleMax), `Максимум ${LIMITS.profile.roleMax} символов`],
      [value.length > 0 && !validatorFormat.role(value), 'Недопустимые символы']
    ],
    description: [
      [!validatorFormat.maxLength(value, LIMITS.profile.descriptionMax), `Максимум ${LIMITS.profile.descriptionMax} символов`]
    ],
    hardSkills: [
      [value.length > 0 && !validatorFormat.hasTag(value), 'Теги должны начинаться с # и содержать только буквы, цифры и _']
    ],
    softSkills: [
      [value.length > 0 && !validatorFormat.hasTag(value), 'Теги должны начинаться с # и содержать только буквы, цифры и _']
    ],
  }
  
  const fieldRules = rules[fieldName as keyof typeof rules]
  if (!fieldRules) return null
  
  const error = fieldRules.find(([isInvalid]) => isInvalid)
  return error?.[1] ?? null
}