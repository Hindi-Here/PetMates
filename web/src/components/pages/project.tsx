import './project.scss'

import Add from '@icons/plus.svg?react'
import Delete from '@icons/delete.svg?react'
import Edit from '@icons/edit.svg?react'
import Accept from '@icons/accept.svg?react'
import Reject from '@icons/reject.svg?react'
import ImportantIcon from '@icons/important_warning.svg?react'
import AdminProjectIcon from '@icons/admin_project.svg?react' 

import { useEffect, useState, useRef, Fragment } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Toggle } from '../common/toggle'
import { validatorFormat, validatorRegex, useChangeInput } from '../scripts/function'

import { Dropdown } from '../common/dropdown' 
import { useIsOpen } from '../scripts/function'  
import DropdownIcon from '@icons/dropdown.svg?react'

import { ProjectPreview } from './project_preview'
import { projectsApi } from '../services/project'
import { projectMembersApi } from '../services/project_members'
import { usersApi, type UserData } from '../services/users'
import { vacanciesApi, type VacancyData } from '../services/vacancy'

import DeleteProjectForm from '../forms/delete_project'
import InfoCircleIcon from '@icons/info_circle.svg?react' 

import { responseApi, type ResponseData } from '../services/response'
import { inviteApi, type InviteData } from '../services/invite' 
import { notificationApi } from '../services/notification'
import InfoIcon from '@icons/info.svg?react'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'

export interface TeamMemberWithUser {
  memberId: string
  projectId: string
  userId: string
  role: string
  joinedAt?: string
  userData?: UserData
  isOwner?: boolean
}

interface LocalVacancy extends VacancyData {
  createdAt?: string
  _isNew?: boolean
  _isModified?: boolean
}

const STATUS_OPTIONS = ['В процессе', 'Завершён', 'Приостановлен']

const getVisualLineCount = (text: string, element: HTMLElement) => {
  const computed = window.getComputedStyle(element);
  const lineHeight = parseFloat(computed.lineHeight);
  if (isNaN(lineHeight)) return text.split('\n').length;

  const mirror = document.createElement('div');
  mirror.style.cssText = `
    position: absolute;
    visibility: hidden;
    height: auto;
    width: ${element.clientWidth}px;
    font-family: ${computed.fontFamily};
    font-size: ${computed.fontSize};
    font-weight: ${computed.fontWeight};
    line-height: ${computed.lineHeight};
    white-space: pre-wrap;
    word-wrap: break-word;
    padding: 0; /* УБРАЛИ PADDING */
    box-sizing: border-box;
  `;
  mirror.textContent = text || '.';
  document.body.appendChild(mirror);
  const height = mirror.offsetHeight;
  document.body.removeChild(mirror);
  
  return Math.ceil(height / lineHeight);
}

const VacancyCard = ({ 
  vacancy, 
  onEdit, 
  onDelete 
}: { 
  vacancy: LocalVacancy
  onEdit: (v: LocalVacancy) => void
  onDelete: (id: string) => void
}) => (
  <div className='vacancy-card-container'>
    <div className='vacancy-info-container'>
      <div className='vacancy-header'>
        <div className='vacancy-header-left'>
          <p className='vacancy-title'>{vacancy.title}</p>
          <p className='vacancy-project-name'>{vacancy.projectTitle || 'PetMates'}</p>
        </div>
        <div className='vacancy-actions'>
          <button className='member-edit-badge' onClick={() => onEdit(vacancy)} title="Редактировать">
            <Edit className='ico' />
          </button>
          <button className='member-remove-badge' onClick={() => onDelete(vacancy.vacancyId)} title="Удалить">
            <Delete className='ico' />
          </button>
        </div>
      </div>
      <p className='vacancy-description'>{vacancy.description}</p>
    </div>
    {vacancy.requiredTags && vacancy.requiredTags.length > 0 && (
      <div className='tag-place-container'>
        {vacancy.requiredTags.map((tag, index) => (
          <div key={index} className='tag-item'>
            <p className='tag-text'>{tag}</p>
          </div>
        ))}
      </div>
    )}
  </div>
)

const TeamMemberProjectCard = ({ 
  member, 
  onRemove,
  onUpdateRole,
  isOwner 
}: { 
  member: TeamMemberWithUser
  onRemove?: () => void
  onUpdateRole?: (memberId: string, newRole: string) => void
  isOwner: boolean
}) => {
  const navigate = useNavigate()
  const user = member.userData
  const rowRef = useRef<HTMLDivElement>(null)
  const tagRowRef = useRef<HTMLDivElement>(null)

  const [isEditingRole, setIsEditingRole] = useState(false)
  const [editedRole, setEditedRole] = useState(member.role)
  const [roleError, setRoleError] = useState<string | null>(null)
  const roleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setEditedRole(member.role) }, [member.role])
  useEffect(() => {
    if (isEditingRole && roleInputRef.current) {
      roleInputRef.current.focus()
      roleInputRef.current.select()
    }
  }, [isEditingRole])

  const checkRoleFormat = (value: string): string | null => {
    const rules: Array<[boolean, string]> = [
      [!validatorFormat.required(value), 'Введите роль'],
      [!validatorFormat.maxLength(value, 50), 'Максимум 50 символов'],
      [value.length > 0 && value.length < 2, 'Минимум 2 символа'],
    ]

    const error = rules.find(([isInvalid]) => isInvalid)
    return error?.[1] ?? null
  }

  const metaInfo = [user?.realName, user?.age && `${user.age} лет`, user?.city, user?.workplace].filter(Boolean)
  const skills: string[] = user?.hardSkills || []
  const [visibleMetaCount, setVisibleMetaCount] = useState(metaInfo.length)
  const [visibleTagCount, setVisibleTagCount] = useState(skills.length)

  useEffect(() => {
    const row = rowRef.current; if (!row) return
    requestAnimationFrame(() => {
      if (!row) return
      const rowWidth = row.clientWidth; const nickEl = row.querySelector('.nickname-text') as HTMLElement
      if (!nickEl) return
      let usedWidth = nickEl.offsetWidth + 12; let count = 0
      const items = row.querySelectorAll('.meta-item') as NodeListOf<HTMLElement>
      const separators = row.querySelectorAll('.meta-separator') as NodeListOf<HTMLElement>
      items.forEach((item, i) => {
        const sepWidth = i > 0 ? (separators[i - 1]?.offsetWidth ?? 0) + 8 : 0
        usedWidth += item.offsetWidth + 8 + sepWidth
        if (usedWidth <= rowWidth) count++
      })
      setVisibleMetaCount(count)
    })
  }, [metaInfo])

  useEffect(() => {
    const row = tagRowRef.current; if (!row) return
    requestAnimationFrame(() => {
      if (!row) return
      const rowWidth = row.clientWidth - 32; let usedWidth = 0; let count = 0
      const items = row.querySelectorAll('.tag-item:not(.more-tag)') as NodeListOf<HTMLElement>
      items.forEach((item) => { usedWidth += item.offsetWidth + 8; if (usedWidth <= rowWidth) count++ })
      if (count < skills.length) {
        const moreTag = row.querySelector('.more-tag') as HTMLElement
        const moreWidth = moreTag ? moreTag.offsetWidth + 8 : 50
        let recalc = 0; usedWidth = 0
        items.forEach((item) => { usedWidth += item.offsetWidth + 8; if (usedWidth + moreWidth <= rowWidth) recalc++ })
        count = recalc
      }
      setVisibleTagCount(Math.max(count, 0))
    })
  }, [skills])

  const hiddenSkillsCount = Math.max(0, skills.length - visibleTagCount)

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.member-remove, .member-edit, .member-accept, .member-reject, .role-input')) return
    if (user?.userId) navigate(`/profile/${user.userId}/info`)
  }

  const handleEditRoleClick = (e: React.MouseEvent) => { 
    e.stopPropagation()
    setIsEditingRole(true)
    setEditedRole(member.role)
    setRoleError(null)
  }

  const handleAcceptRoleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const error = checkRoleFormat(editedRole)
    
    if (error) {
      setRoleError(error)
      return
    }
    
    if (editedRole.trim() && editedRole !== member.role && onUpdateRole) {
      onUpdateRole(member.memberId, editedRole.trim())
    }
    setIsEditingRole(false)
    setRoleError(null)
  }

  const handleRoleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAcceptRoleClick(e as any)
    else if (e.key === 'Escape') { 
      setIsEditingRole(false)
      setEditedRole(member.role)
      setRoleError(null)
    }
  }

  const handleRoleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedRole(e.target.value)
    if (roleError) setRoleError(null)
  }

  if (!user) return null

  return (
    <div className='team-member-project-card' onClick={handleCardClick}>
      <div className='info-place-container'>
        <div className='avatar-container'>
          <img src={user.avatarUrl || '/default-avatar.png'} alt={user.nickname} />
        </div>
        <div className='info-container'>
          <div className='nickname-row' ref={rowRef}>
            <p className='nickname-text'>{user.nickname}</p>
            {visibleMetaCount > 0 && (
              <div className='meta-info'>
                {metaInfo.slice(0, visibleMetaCount).map((info, index) => (
                  <Fragment key={index}>
                    {index > 0 && <div className='meta-separator' />}
                    <p className='meta-item'>{info}</p>
                  </Fragment>
                ))}
              </div>
            )}
            <div className='member-badges'>
              {onUpdateRole && !isEditingRole && (
                <button className='member-edit-badge' onClick={handleEditRoleClick} title="Редактировать роль"><Edit className='ico' /></button>
              )}
              {onUpdateRole && isEditingRole && (
                <button className='member-accept-badge' onClick={handleAcceptRoleClick} disabled={!editedRole.trim() || editedRole === member.role} title="Сохранить роль"><Accept className='ico' /></button>
              )}
              {onUpdateRole && isEditingRole && (
                <button className='member-reject-badge' onClick={(e) => { e.stopPropagation(); setIsEditingRole(false); setEditedRole(member.role); setRoleError(null) }} title="Отменить"><Reject className='ico' /></button>
              )}
              {isOwner && (<span className='owner-badge'><AdminProjectIcon className='owner-icon' />Владелец</span>)}
              {!isOwner && onRemove && !isEditingRole && (
                <button className='member-remove-badge' onClick={(e) => { e.stopPropagation(); onRemove() }} title="Удалить"><Delete className='ico' /></button>
              )}
            </div>
          </div>
          {isEditingRole ? (
            <>
              <input 
                ref={roleInputRef} 
                className={`role-input ${roleError ? 'input-error' : ''}`} 
                value={editedRole} 
                onChange={handleRoleChange} 
                onKeyDown={handleRoleKeyDown} 
                placeholder="Роль"
                maxLength={50}
              />
              {roleError && <p className="field-error-text">{roleError}</p>}
            </>
          ) : (
            <p className='role-text'>{member.role || 'Нет указанной роли'}</p>
          )}
          {user.isOnline ? (
            <div className='online-container'><div className='circle-online' /><p className='online-text'>Онлайн</p></div>
          ) : (
            <p className='online-text offline'>Был(а) {user.lastSeen}</p>
          )}
        </div>
      </div>
      {skills.length > 0 && (
        <div className='tag-place-container' ref={tagRowRef}>
          {skills.map((skill, index) => (
            <div key={index} className='tag-item' style={index >= visibleTagCount ? { position: 'absolute', visibility: 'hidden', pointerEvents: 'none' } : {}}><p className='tag-text'>{skill}</p></div>
          ))}
          <div className='tag-item more-tag' style={hiddenSkillsCount === 0 ? { position: 'absolute', visibility: 'hidden', pointerEvents: 'none' } : {}}><p className='tag-text'>+{hiddenSkillsCount}</p></div>
        </div>
      )}
    </div>
  )
}

interface ProjectProps { onCancel?: () => void }

export const Project = ({ onCancel }: ProjectProps) => {
  const navigate = useNavigate()
  const { projectId, profileId } = useParams<{ projectId: string; profileId: string }>()
  const profilePath = profileId ? `/profile/${profileId}` : '/profile'
  const [isPreview, setIsPreview] = useState(false)
  
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [projectRating, setProjectRating] = useState(0)

  const [name, setName] = useState('Unnamed')
  const [shortDesc, setShortDesc] = useState('')
  const [status, setStatus] = useState(STATUS_OPTIONS[0])
  const { isOpen: isStatusOpen, setIsOpen: setStatusOpen, menuRef: statusMenuRef } = useIsOpen()
  const statusOptions = STATUS_OPTIONS.map(s => ({ id: s, label: s }))
  const handleStatusSelect = (item: { id: string; label: string }) => { setStatus(item.label); setStatusOpen(false) }
  const [description, setDescription] = useState('')

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [inviteRoleError, setInviteRoleError] = useState<string | null>(null)
  const [inviteMessage, setInviteMessage] = useState('На указанный email будет отправлено приглашение на участие в проекте')
  const [inviteMessageType, setInviteMessageType] = useState<'info' | 'error' | 'success'>('info')

  const [showVacancyForm, setShowVacancyForm] = useState(false)
  const [editingVacancy, setEditingVacancy] = useState<LocalVacancy | null>(null)
  const [vacTitle, setVacTitle] = useState('')
  const [vacDesc, setVacDesc] = useState('')
  const [vacTags, setVacTags] = useState('')

  const [vacancyTouched, setVacancyTouched] = useState({
    vacTitle: false,
    vacDesc: false,
    vacTags: false,
  })

  const [localVacancies, setLocalVacancies] = useState<LocalVacancy[]>([])
  const [deletedVacancyIds, setDeletedVacancyIds] = useState<string[]>([])
  const vacanciesSyncedRef = useRef(false)

  const [localTeamMembers, setLocalTeamMembers] = useState<TeamMemberWithUser[]>([])
  const [deletedMemberIds, setDeletedMemberIds] = useState<string[]>([])
  const [editedRoles, setEditedRoles] = useState<Record<string, string>>({})
  const [initialTeamState, setInitialTeamState] = useState<TeamMemberWithUser[]>([])
  const teamInitializedRef = useRef(false)

  const [initialState, setInitialState] = useState(() => ({
    name: 'Unnamed', shortDesc: '', status: STATUS_OPTIONS[0], description: '',
  }))

  const queryClient = useQueryClient()

  const [currentUserNickname, setCurrentUserNickname] = useState<string | null>(null)

  const { 
    touched: projectTouched, 
    dirty: projectDirty,
    handleChange: handleProjectChange,
    handleBlur: handleProjectBlur 
  } = useChangeInput(
    {
      name: '',
      shortDesc: '',
      status: STATUS_OPTIONS[0],
      description: '',
    },
    {
      name: (val: string) => validatorRegex.text(val, 50),
      shortDesc: (val: string) => validatorRegex.text(val, 150),
      status: (val: string) => val,
      description: (val: string) => validatorRegex.message(val),
    }
  )

  const checkRoleFormat = (value: string): string | null => {
    const rules: Array<[boolean, string]> = [
      [!validatorFormat.required(value), 'Введите роль'],
      [!validatorFormat.maxLength(value, 50), 'Максимум 50 символов'],
      [value.length > 0 && value.length < 2, 'Минимум 2 символа'],
    ]

    const error = rules.find(([isInvalid]) => isInvalid)
    return error?.[1] ?? null
  }

  const { data: project } = useQuery({
    queryKey: queryKeys.projects.byId(projectId!),
    queryFn: () => projectsApi.getProject(projectId!),
    enabled: !!projectId,
    staleTime: 0,
  })

  const { data: teamMembers = [] } = useQuery({
    queryKey: queryKeys.projects.memberProjects(projectId!),
    queryFn: async () => {
      if (!projectId) return []
      const [members, proj] = await Promise.all([
        projectMembersApi.getByProject(projectId),
        projectsApi.getProject(projectId)
      ])
      const membersWithUsers = await Promise.all(
        members.map(async (member) => {
          try {
            const userData = await usersApi.getUserById(member.userId)
            return { ...member, userData, isOwner: member.userId === proj.ownerId }
          }
          catch {
            return { ...member, isOwner: member.userId === proj.ownerId }
          }
        })
      )
      return membersWithUsers.sort((a, b) => {
        if (!a.joinedAt || !b.joinedAt) return 0
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
      })
    },
    enabled: !!projectId,
    staleTime: 0,
  })

  const { data: vacanciesFromDb = [] } = useQuery({
    queryKey: queryKeys.vacancies.byProject(projectId!),
    queryFn: () => vacanciesApi.getByProject(projectId!),
    enabled: !!projectId,
    staleTime: 0,
  })

  const { data: responses = [] } = useQuery({
    queryKey: queryKeys.responses.byProject(projectId!),
    queryFn: () => responseApi.getByProject(projectId!),
    enabled: !!projectId,
    staleTime: 0,
  })

  const { data: allInvites = [] } = useQuery({
    queryKey: queryKeys.invites.outgoing(profileId || ''),
    queryFn: () => inviteApi.getOutgoing(),
    enabled: !!profileId,
    staleTime: 0,
  })

  const projectInvites = allInvites.filter(invite => invite.projectId === projectId)

  useEffect(() => {
    const fetchNickname = async () => {
      const { userId } = await import('../hooks/useAuth').then(m => m.useAuth())
      if (!userId) return
      try {
        const user = await usersApi.getUserById(userId)
        setCurrentUserNickname(user?.nickname || null)
      }
      catch (error) {
        console.error('Ошибка получения никнейма:', error)
      }
    }
    fetchNickname()
  }, [])

  useEffect(() => {
    if (teamMembers.length > 0 && !teamInitializedRef.current) {
      const membersCopy = teamMembers.map(m => ({ ...m }))
      setLocalTeamMembers(membersCopy)
      setInitialTeamState(membersCopy)
      teamInitializedRef.current = true
    }
  }, [teamMembers])

  useEffect(() => {
    if (vacanciesFromDb.length > 0 && !vacanciesSyncedRef.current) {
      setLocalVacancies(vacanciesFromDb.map(v => ({ ...v })))
      vacanciesSyncedRef.current = true
    }
  }, [vacanciesFromDb])

  useEffect(() => {
    if (project) {
      setName(project.title)
      setShortDesc(project.shortDescription || '')
      setStatus(project.status)
      setDescription(project.fullDescription || '')
      setProjectRating(project.ratingCount || 0)
      setInitialState({
        name: project.title,
        shortDesc: project.shortDescription || '',
        status: project.status,
        description: project.fullDescription || '',
      })
      
      handleProjectChange({ target: { name: 'name', value: project.title } } as any)
      handleProjectChange({ target: { name: 'shortDesc', value: project.shortDescription || '' } } as any)
      handleProjectChange({ target: { name: 'status', value: project.status } } as any)
      handleProjectChange({ target: { name: 'description', value: project.fullDescription || '' } } as any)
    }
  }, [project])

  const hasVacancyChanges = 
    deletedVacancyIds.length > 0 || 
    localVacancies.some(v => v._isNew || v._isModified);

  const hasTeamChanges = 
    deletedMemberIds.length > 0 || 
    Object.keys(editedRoles).length > 0;

  const hasChanges = 
    name !== initialState.name ||
    shortDesc !== initialState.shortDesc ||
    status !== initialState.status ||
    description !== initialState.description ||
    hasVacancyChanges ||
    hasTeamChanges;

  const checkProjectFormat = (fieldName: string, value: string): string | null => {
    const rules: Record<string, Array<[boolean, string]>> = {
      name: [
        [!validatorFormat.required(value), 'Введите название проекта'],
        [!validatorFormat.maxLength(value, 50), 'Максимум 50 символов']
      ],
      shortDesc: [
        [!validatorFormat.maxLength(value, 150), 'Максимум 150 символов']
      ],
    }

    const fieldRules = rules[fieldName as keyof typeof rules]
    if (!fieldRules) return null

    const error = fieldRules.find(([isInvalid]) => isInvalid)
    return error?.[1] ?? null
  }

  const checkVacancyFormat = (fieldName: string, value: string): string | null => {
    const rules: Record<string, Array<[boolean, string]>> = {
      vacTitle: [
        [!validatorFormat.required(value), 'Введите название роли'],
        [!validatorFormat.maxLength(value, 50), 'Максимум 50 символов']
      ],
      vacDesc: [
        [!validatorFormat.required(value), 'Введите описание'],
        [!validatorFormat.maxLength(value, 500), 'Максимум 500 символов']
      ],
      vacTags: [
        [!validatorFormat.required(value), 'Введите теги'],
        [value.length > 0 && !validatorFormat.hasTag(value), 'Теги должны начинаться с # и содержать только буквы, цифры и _']
      ],
    }

    const fieldRules = rules[fieldName as keyof typeof rules]
    if (!fieldRules) return null

    const error = fieldRules.find(([isInvalid]) => isInvalid)
    return error?.[1] ?? null
  }

  const isProjectFormValid = (() => {
    const nameValid = !checkProjectFormat('name', name)
    const shortDescValid = !checkProjectFormat('shortDesc', shortDesc)

    const vacanciesValid = localVacancies
      .filter(v => !deletedVacancyIds.includes(v.vacancyId))
      .filter(v => v._isNew || v._isModified)
      .every(v => 
        !checkVacancyFormat('vacTitle', v.title) &&
        !checkVacancyFormat('vacDesc', v.description) &&
        !checkVacancyFormat('vacTags', v.requiredTags?.join(' ') || '')
      )

    return nameValid && shortDescValid && vacanciesValid
  })();

  const sendNotification = (
    userId: string,
    referenceType: string,
    referenceId: string,
    eventType: string,
    contextData: Record<string, any>
  ) => {
    const notificationData = {
      userId,
      referenceType,
      referenceId,
      contextData: {
        ...contextData,
        eventType,
        projectName: name || project?.title || 'Проект',
      }
    }
    
    notificationApi.create(notificationData)
      .then(() => {
      })
      .catch(err => {
        console.error('Ошибка создания уведомления:', err)
        console.error('Данные:', notificationData)
      })
  }

  const notifyAllMembersExceptOwner = (
    referenceType: string,
    referenceId: string,
    eventType: string,
    contextData: Record<string, any>,
    excludeUserIds: string[] = []
  ) => {
    const ownerId = project?.ownerId
    const membersToNotify = localTeamMembers.filter(m => 
      !m.isOwner && 
      m.userId !== ownerId && 
      !excludeUserIds.includes(m.userId)
    )
  
    membersToNotify.forEach(member => {
      sendNotification(member.userId, referenceType, referenceId, eventType, contextData)
    })
  }

  const handleCancel = () => { 
    setName(initialState.name)
    setShortDesc(initialState.shortDesc)
    setStatus(initialState.status)
    setDescription(initialState.description)
    setLocalTeamMembers(initialTeamState.map(m => ({ ...m })))
    setDeletedMemberIds([])
    setEditedRoles({})
    setLocalVacancies(vacanciesFromDb.map(v => ({ ...v })))
    setDeletedVacancyIds([])
  }
  
  const handleBack = () => { 
    if (onCancel) { onCancel(); return } 
    navigate(`${profilePath}/activity`, { replace: true }) 
  }

  const handleSave = async () => {
    if (!projectId || !hasChanges || !isProjectFormValid) return
    setIsSaving(true)
    setSaveError(null)

    try {
      const changes: Record<string, any> = {}
      if (name !== initialState.name) changes.title = name
      if (shortDesc !== initialState.shortDesc) changes.shortDescription = shortDesc
      if (status !== initialState.status) changes.status = status
      if (description !== initialState.description) changes.fullDescription = description

      if (Object.keys(changes).length > 0) {
        await projectsApi.updateProject(projectId, changes)
      }

      if (deletedVacancyIds.length > 0) {
        deletedVacancyIds.forEach(vacancyId => {
          if (vacancyId.startsWith('temp_')) return
          
          const vacancy = localVacancies.find(v => v.vacancyId === vacancyId)
          if (!vacancy) return
          
          const vacancyResponses = responses.filter(r => r.vacancyId === vacancyId)
          const uniqueRespondents = new Map<string, ResponseData>()
          vacancyResponses.forEach(r => {
            if (!uniqueRespondents.has(r.userId)) {
              uniqueRespondents.set(r.userId, r)
            }
          })
          
          uniqueRespondents.forEach((_, userId) => {
            sendNotification(userId, 'response', projectId!, 'responses_revoked_vacancy_deleted', {
              projectName: name || project?.title || 'Проект',
              vacancyName: vacancy.title || 'Заявка',
            })
          })
          
          const vacancyInvites = projectInvites.filter(i => i.role === vacancy.title && i.status === 'pending')
          const uniqueInvitees = new Map<string, InviteData>()
          vacancyInvites.forEach(i => {
            if (!uniqueInvitees.has(i.userId)) {
              uniqueInvitees.set(i.userId, i)
            }
          })
          
          uniqueInvitees.forEach((_, userId) => {
            sendNotification(userId, 'invite', projectId!, 'invites_revoked_vacancy_deleted', {
              projectName: name || project?.title || 'Проект',
              vacancyName: vacancy.title || 'Заявка',
            })
          })
        })
        
        await Promise.all(deletedVacancyIds.map(id => vacanciesApi.delete(id)))
        setDeletedVacancyIds([])
      }

      await Promise.all(localVacancies.map(async v => {
        const data = {
          projectId,
          title: v.title,
          role: v.title,
          description: v.description,
          requiredTags: v.requiredTags || [],
        }
        if (v._isNew) {
          await vacanciesApi.create(data)
        } else if (v._isModified) {
          await vacanciesApi.update(v.vacancyId, data)
        }
      }))

      if (deletedMemberIds.length > 0) {
        const removedMembers = initialTeamState.filter(m => deletedMemberIds.includes(m.memberId))
        
        await Promise.all(deletedMemberIds.map(memberId => 
          projectMembersApi.removeMember(memberId)
        ))
        
        removedMembers.forEach(member => {
          const nickname = member.userData?.nickname || 'Пользователь'
          const projectName = name || project?.title || 'Проект'
          
          if (project?.ownerId) {
            sendNotification(project.ownerId, 'project', projectId!, 'removed', {
              nickname,
              projectName,
            })
          }
          
          sendNotification(member.userId, 'project', projectId!, 'removed_self', {
            projectName,
          })
        })
        
        setDeletedMemberIds([])
      }

      const roleUpdates = Object.entries(editedRoles).map(([memberId, newRole]) => ({
        memberId,
        newRole
      }))

      if (roleUpdates.length > 0) {
        await Promise.all(roleUpdates.map(({ memberId, newRole }) =>
          projectMembersApi.updateMemberRole(memberId, newRole)
        ))
        
        roleUpdates.forEach(({ memberId, newRole }) => {
          const member = initialTeamState.find(m => m.memberId === memberId)
          if (!member) return
          
          const nickname = member.userData?.nickname || 'Пользователя'
          const projectName = name || project?.title || 'Проект'
          
          if (project?.ownerId) {
            sendNotification(project.ownerId, 'project', projectId!, 'role_changed', {
              nickname,
              projectName,
              role: newRole,
            })
          }
          
          sendNotification(member.userId, 'project', projectId!, 'role_changed_self', {
            projectName,
            role: newRole,
          })
        })
        
        setEditedRoles({})
      }

      if (status !== initialState.status) {
        const projectName = name || project?.title || 'Проект'
        
        if (project?.ownerId) {
          sendNotification(project.ownerId, 'project', projectId!, 'status_changed', {
            projectName,
            status,
          })
        }
        
        notifyAllMembersExceptOwner('project', projectId!, 'status_changed', {
          projectName,
          status,
        })
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.projects.byId(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.vacancies.byProject(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.memberProjects(projectId!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })

      teamInitializedRef.current = false
      vacanciesSyncedRef.current = false

      setInitialState({ name, shortDesc, status, description })
      
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)

    }
    catch (error) {
      const msg = error instanceof Error ? error.message : 'Не удалось сохранить проект'
      setSaveError(msg)
      setTimeout(() => setSaveError(null), 3000)
    }
    finally {
      setIsSaving(false)
    }
  }

  const inviteMemberMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const emailValid = validatorFormat.email(email)
      const roleError = checkRoleFormat(role)
      
      if (!emailValid) {
        throw new Error('Введите корректный email')
      }
      
      if (roleError) {
        throw new Error(roleError)
      }
      
      const targetUser = await usersApi.findByEmail(email)
      
      if (!targetUser) throw new Error('Пользователя с такой почтой не существует')
      
      try {
        await projectMembersApi.addMember({ 
          projectId: projectId!, 
          userId: targetUser.userId, 
          role: role.trim() 
        })
      } catch (addError: any) {
        const errorMsg = String(
          addError?.message || 
          addError?.details?.message || 
          addError?.details?.error ||
          addError?.toString?.() || 
          ''
        ).toLowerCase()
        
        if (
          errorMsg.includes('уже является участником') ||
          errorMsg.includes('already') ||
          errorMsg.includes('duplicate') ||
          errorMsg.includes('conflict') ||
          addError?.status === 409 ||
          addError?.status === 400
        ) {
          throw new Error('Этот пользователь уже в команде')
        }
        
        throw addError
      }
      return targetUser
    },
    onSuccess: async (targetUser) => {
      setInviteEmail('')
      setInviteRole('')
      setInviteRoleError(null)
      setInviteMessage('Участник успешно добавлен в команду')
      setInviteMessageType('success')
      setTimeout(() => resetInviteMessage(), 3000)
      
      teamInitializedRef.current = false
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.memberProjects(projectId!) })
      
      const projectName = name || project?.title || 'Проект'
      const nickname = targetUser.nickname || 'Пользователь'
      const role = inviteRole.trim()
      
      if (project?.ownerId) {
        sendNotification(project.ownerId, 'project', projectId!, 'added', {
          nickname,
          projectName,
          role,
        })
      }
      
      sendNotification(targetUser.userId, 'project', projectId!, 'added_self', {
        projectName,
        role,
      })
      
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
    onError: (error: any) => {
      const message = error?.message || error?.toString?.() || 'Не удалось добавить участника'
      setInviteMessage(message)
      setInviteMessageType('error')
      setTimeout(() => resetInviteMessage(), 3000)
    },
  })

  const handleInvite = () => {
    const roleError = checkRoleFormat(inviteRole)
    setInviteRoleError(roleError)
    
    if (!roleError) {
      inviteMemberMutation.mutate({ email: inviteEmail, role: inviteRole })
    }
  }

  const handleInviteRoleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInviteRole(e.target.value)
    if (inviteRoleError) setInviteRoleError(null)
  }

  const handleInviteRoleBlur = () => {
    if (inviteRole.trim()) {
      setInviteRoleError(checkRoleFormat(inviteRole))
    }
  }

  const resetInviteMessage = () => { 
    setInviteMessage('На указанный email будет отправлено приглашение на участие в проекте')
    setInviteMessageType('info')
    setInviteRoleError(null)
  }

  const handleRemoveMember = (memberId: string) => {
    setLocalTeamMembers(prev => prev.filter(m => m.memberId !== memberId))
    setDeletedMemberIds(prev => [...prev, memberId])
    setEditedRoles(prev => {
      const newRoles = { ...prev }
      delete newRoles[memberId]
      return newRoles
    })
  }

  const handleUpdateMemberRole = (memberId: string, newRole: string) => {
    setLocalTeamMembers(prev => prev.map(m => 
      m.memberId === memberId ? { ...m, role: newRole } : m
    ))
    setEditedRoles(prev => ({ ...prev, [memberId]: newRole }))
  }

  const openVacancyForm = (v?: LocalVacancy) => {
    if (v) {
      setEditingVacancy(v)
      setVacTitle(v.title)
      setVacDesc(v.description)
      setVacTags(v.requiredTags?.join(' ') || '')
    } else {
      setEditingVacancy(null)
      setVacTitle(''); setVacDesc(''); setVacTags('')
    }
    setVacancyTouched({ vacTitle: false, vacDesc: false, vacTags: false })
    setShowVacancyForm(true)
  }

  const closeVacancyForm = () => {
    setShowVacancyForm(false)
    setEditingVacancy(null)
    setVacTitle(''); setVacDesc(''); setVacTags('')
    setVacancyTouched({ vacTitle: false, vacDesc: false, vacTags: false })
  }

  const saveVacancy = () => {
    if (!vacTitle.trim()) return
    const tags = vacTags.trim().split(/\s+/).filter(Boolean)

    if (editingVacancy) {
      setLocalVacancies(prev => prev.map(v =>
        v.vacancyId === editingVacancy.vacancyId
          ? { ...v, title: vacTitle, description: vacDesc, requiredTags: tags, _isModified: !v._isNew }
          : v
      ))
    }
    else {
      const tempVacancy: LocalVacancy = {
        vacancyId: `temp_${Date.now()}`,
        projectId: projectId!,
        title: vacTitle,
        role: vacTitle,
        description: vacDesc,
        requiredTags: tags,
        projectTitle: name,
        ratingCount: 0,
        createdAt: new Date().toISOString(),
        _isNew: true,
      }
      setLocalVacancies(prev => [...prev, tempVacancy])
    }

    closeVacancyForm()
  }

  const deleteVacancy = (vacancyId: string) => {
    setLocalVacancies(prev => prev.filter(v => v.vacancyId !== vacancyId))
    if (!vacancyId.startsWith('temp_')) {
      setDeletedVacancyIds(prev => [...prev, vacancyId])
    }
  }

  const [showDeleteForm, setShowDeleteForm] = useState(false)
  const handleDeleteClick = () => { if (projectId) setShowDeleteForm(true) }
  
  const handleDeleteSuccess = () => {
    const projectName = name || project?.title || 'Проект'
    
    notifyAllMembersExceptOwner('project', projectId!, 'project_deleted', {
      projectName,
    })
    
    const uniqueRespondents = new Map<string, ResponseData>()
    responses.forEach(r => {
      if (!uniqueRespondents.has(r.userId)) {
        uniqueRespondents.set(r.userId, r)
      }
    })
    
    uniqueRespondents.forEach((response, userId) => {
      sendNotification(userId, 'response', projectId!, 'responses_revoked_project_deleted', {
        projectName,
        nickname: response.userNickname || 'Пользователь',
      })
    })
    
    const uniqueInvitees = new Map<string, InviteData>()
    projectInvites.forEach(i => {
      if (!uniqueInvitees.has(i.userId)) {
        uniqueInvitees.set(i.userId, i)
      }
    })
    
    uniqueInvitees.forEach((invite, userId) => {
      sendNotification(userId, 'invite', projectId!, 'invites_revoked_project_deleted', {
        projectName,
        nickname: invite.userName || 'Пользователь',
      })
    })
    
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    
    navigate(`${profilePath}/activity`, { replace: true })
  }

  const handleResponseAction = async (response: ResponseData, action: 'accept' | 'decline') => {
    try {
      await responseApi.delete(response.responseId)
      
      const eventType = action === 'accept' ? 'response_accepted' : 'response_rejected'
      
      sendNotification(response.userId, 'response', response.projectId, eventType, {
        projectName: response.projectTitle || 'Проект',
        vacancyName: response.vacancyTitle || 'Заявка',
      })
      
      if (action === 'accept' && project?.ownerId) {
        try {
          await projectMembersApi.addMember({
            projectId: projectId!,
            userId: response.userId,
            role: response.vacancyTitle || 'Участник'
          })
          
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.memberProjects(projectId!) })
          teamInitializedRef.current = false
        }
        catch (addError) {
          console.error('Ошибка добавления участника:', addError)
        }
      }
      
      queryClient.invalidateQueries({ queryKey: queryKeys.responses.byProject(projectId!) })
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications.all,
        refetchType: 'active'
      })
    }
    catch (error) {
      console.error('Ошибка обработки отклика:', error)
    }
  }

  const handleCancelInvite = async (invite: InviteData) => {
    try {
      await inviteApi.delete(invite.inviteId)
      
      sendNotification(invite.userId, 'invite', invite.projectId, 'invite_cancelled', {
        projectName: invite.projectTitle || 'Проект',
        vacancyName: invite.role || 'Заявка',
        nickname: currentUserNickname || 'Пользователь',
      })
      
      queryClient.invalidateQueries({ queryKey: queryKeys.invites.outgoing(profileId || '') })
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications.all,
        refetchType: 'active'
      })
    }
    catch (error) {
      console.error('Ошибка отмены приглашения:', error)
    }
  }

  return (
    <div className='project-page'>

      {isPreview ? (
        <ProjectPreview name={name} shortDesc={shortDesc} status={status} description={description} team={localTeamMembers} vacancies={localVacancies} isOwner={true} ratingCount={projectRating} />
      ) : (
        <>
          <section className='project-section'>
            <h2 className='project-section-title'>Базовая информация о проекте</h2>
            <div className='project-form-grid'>
              <div className='project-field-row'>
                <label className='project-field-label'>Название проекта:</label>
                <input 
                  name="name"
                  className={`project-field-input ${projectTouched.name && projectDirty.name && checkProjectFormat('name', name) ? 'input-error' : ''}`} 
                  value={name} 
                  onChange={e => {
                    setName(e.target.value)
                    handleProjectChange(e)
                  }} 
                  onBlur={handleProjectBlur}
                  maxLength={50} />
              </div>
              <div className='project-field-row'>
                <label className='project-field-label'>Краткое описание:</label>
                <input 
                  name="shortDesc"
                  className={`project-field-input ${projectTouched.shortDesc && projectDirty.shortDesc && checkProjectFormat('shortDesc', shortDesc) ? 'input-error' : ''}`} 
                  value={shortDesc} 
                  onChange={e => {
                    setShortDesc(e.target.value)
                    handleProjectChange(e)
                  }} 
                  onBlur={handleProjectBlur}
                  maxLength={150} />
              </div>
              <div className='project-field-row'>
                <label className='project-field-label'>Статус:</label>
                <div className='project-select-wrapper' ref={statusMenuRef}>
                  <div className={`project-select ${isStatusOpen ? 'active' : ''}`} onClick={() => setStatusOpen(!isStatusOpen)}>
                    <p className='project-select-value'>{status}</p><DropdownIcon className={`project-select-arrow ${isStatusOpen ? 'rotated' : ''}`} />
                  </div>
                  <Dropdown isOpen={isStatusOpen} items={statusOptions} onSelect={handleStatusSelect} />
                </div>
              </div>
            </div>
          </section>

          <section className='project-section'>
            <div className='project-section-header'><h2 className='project-section-title'>Описание проекта</h2></div>
            <textarea className='project-md-editor' value={description} onChange={e => setDescription(e.target.value)} placeholder={'### Заголовок\nОпишите ваш проект...'} />
          </section>

          <section className='project-section'>
            <h2 className='project-section-title'>Команда: <span className='project-count'>{localTeamMembers.length}</span></h2>
            <div className='team-invite-row'>
              <input 
                className='project-field-input' 
                placeholder='Email участника' 
                value={inviteEmail} 
                onChange={e => setInviteEmail(e.target.value)} 
              />
              <input 
                className={`project-field-input ${inviteRoleError ? 'input-error' : ''}`} 
                placeholder='Роль участника' 
                value={inviteRole} 
                onChange={handleInviteRoleChange}
                onBlur={handleInviteRoleBlur}
                maxLength={50}
              />
              <button 
                className='team-invite-btn' 
                onClick={handleInvite} 
                disabled={
                  !validatorFormat.email(inviteEmail) || 
                  !inviteRole.trim() || 
                  !!inviteRoleError ||
                  inviteMemberMutation.isPending
                }>
                Отправить
              </button>
            </div>
            {inviteRoleError && <p className="field-error-text invite-role-error">{inviteRoleError}</p>}
            <div className={`team-invite-hint ${inviteMessageType}`}><InfoCircleIcon className='info-icon' /><span>{inviteMessage}</span></div>
            <div className='team-members-list'>
              {localTeamMembers.map(member => (
                <TeamMemberProjectCard 
                  key={member.memberId} 
                  member={member} 
                  onRemove={() => handleRemoveMember(member.memberId)} 
                  onUpdateRole={handleUpdateMemberRole} 
                  isOwner={member.isOwner || false}
                />
              ))}
            </div>
          </section>

          <section className='project-section'>
            <h2 className='project-section-title'>Заявки: <span className='project-count'>{localVacancies.length}</span></h2>
            {showVacancyForm ? (
              <div className='vacancy-form'>
                <input 
                  name="vacTitle"
                  className={`project-field-input ${vacancyTouched.vacTitle && checkVacancyFormat('vacTitle', vacTitle) ? 'input-error' : ''}`} 
                  placeholder='Название роли' 
                  value={vacTitle} 
                  onChange={e => setVacTitle(e.target.value)} 
                  onBlur={() => setVacancyTouched(prev => ({ ...prev, vacTitle: true }))}
                  maxLength={50}/>
                <textarea 
                  name="vacDesc"
                  className={`project-md-editor small ${vacancyTouched.vacDesc && checkVacancyFormat('vacDesc', vacDesc) ? 'input-error' : ''}`} 
                  placeholder='Описание заявки' 
                  value={vacDesc} 
                  onChange={e => {
                    const value = e.target.value;
                    if (value.length > 500) return;
                    if (getVisualLineCount(value, e.target) > 10) return;
                    setVacDesc(value);
                  }} 
                  onBlur={() => setVacancyTouched(prev => ({ ...prev, vacDesc: true }))} />
                <textarea 
                  name="vacTags"
                  className={`project-field-input vacancy-tags-input ${vacancyTouched.vacTags && checkVacancyFormat('vacTags', vacTags) ? 'input-error' : ''}`} 
                  placeholder='Теги через пробел: #react #typescript' 
                  value={vacTags} 
                  onChange={e => {
                    let value = validatorRegex.tags(e.target.value);
                    if (getVisualLineCount(value, e.target) > 2) return;
                    setVacTags(value);
                  }} 
                  onBlur={() => setVacancyTouched(prev => ({ ...prev, vacTags: true }))}/>
                <div className='vacancy-form-actions'>
                  <button 
                    className='manage-button' 
                    onClick={saveVacancy} 
                    disabled={
                      !vacTitle.trim() || 
                      !!checkVacancyFormat('vacTitle', vacTitle) ||
                      !!checkVacancyFormat('vacDesc', vacDesc) ||
                      !!checkVacancyFormat('vacTags', vacTags)
                    }>
                    {editingVacancy ? 'Изменить' : 'Добавить'}
                  </button>
                  <button className='manage-button cancellation' onClick={closeVacancyForm}>Отмена</button>
                </div>
              </div>
            ) : (
              <button className='vacancy-add-btn' onClick={() => openVacancyForm()}><div className='add-icon-container'><Add className='add-icon' /></div><span className='add-vacancy-text'>Создать новую заявку</span></button>
            )}
            <div className='vacancy-list'>
              {localVacancies.map(v => (<VacancyCard key={v.vacancyId} vacancy={v} onEdit={openVacancyForm} onDelete={deleteVacancy} />))}
            </div>
          </section>

          {responses.length > 0 && (
            <section className='project-section'>
              <h2 className='project-section-title'>
                Отклики: <span className='project-count'>{responses.length}</span>
              </h2>
              <div className='responses-list'>
                {responses.map(response => (
                  <div key={response.responseId} className='response-card'>
                    <div className='response-card-header'>
                      <div className='response-icon-wrapper'>
                        <InfoIcon className='response-icon' />
                      </div>
                      <div className='response-text'>
                        <p>
                          Вы получили отклик от <strong><em>{response.userNickname}</em></strong> к проекту{' '}
                          <span className='response-project'><em>{response.projectTitle}</em></span> на роль{' '}
                          <span className='response-role'><em>{response.vacancyTitle}</em></span>
                        </p>
                        <p className='response-date'>
                          {new Date(response.createdAt).toLocaleDateString('ru-RU')}
                          {', '}
                          {new Date(response.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className='response-actions'>
                      <button 
                        className='response-button accept' 
                        onClick={() => handleResponseAction(response, 'accept')}>
                        Принять
                      </button>
                      <button 
                        className='response-button decline' 
                        onClick={() => handleResponseAction(response, 'decline')}>
                        Отклонить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {projectInvites.length > 0 && (
            <section className='project-section'>
              <h2 className='project-section-title'>
                Приглашения: <span className='project-count'>{projectInvites.length}</span>
              </h2>
              <div className='invites-list'> 
                {projectInvites.map(invite => (
                  <div key={invite.inviteId} className='response-card'> 
                    <div className='response-card-header'>  
                      <div className='response-icon-wrapper'> 
                        <InfoIcon className='response-icon' />
                      </div>
                      <div className='response-text'> 
                        <p>
                          Приглашение <strong><em>{invite.userName}</em></strong> на участие в проекте{' '}
                          <span className='response-project'><em>{invite.projectTitle}</em></span> на роль{' '}
                          <span className='response-role'><em>{invite.role}</em></span> было отправлено
                        </p>
                        <p className='response-date'> 
                          {new Date(invite.createdAt).toLocaleDateString('ru-RU')}
                          {', '}
                          {new Date(invite.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className='response-actions'> 
                      <button 
                        className='response-button decline' 
                        onClick={() => handleCancelInvite(invite)}>
                        Отменить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className='project-section'>
            <h2 className='project-section-title'>Удаление</h2>
            <div className='warning-container'>
              <div className='warning-tittle-container'><ImportantIcon className='svg-ico' /><p className='warning-tittle'>Удаление проекта</p></div>
              <p className='warning-description'>Это действие необратимо. Ваш проект будет удалён навсегда со всеми данными.</p>
              <button className='warning-button' onClick={handleDeleteClick}><Delete className='svg-ico' />Удалить проект</button>
            </div>
          </section>
        </>
      )}

      <div className='manage-container'>
        <button className='manage-button' onClick={handleSave} disabled={!hasChanges || isSaving || !isProjectFormValid}>
          Сохранить
        </button>
        <button className='manage-button cancellation' onClick={handleCancel} disabled={!hasChanges || isSaving}>Отмена</button>
        <button className='manage-button cancellation' onClick={handleBack} disabled={isSaving}>Назад</button>
        <div className='preview-group'><p className='preview-label'>Предпросмотр</p><Toggle checked={isPreview} onChange={setIsPreview} /></div>
      </div>

      {showDeleteForm && projectId && (<DeleteProjectForm projectId={projectId} onClose={() => setShowDeleteForm(false)} onSuccess={handleDeleteSuccess} />)}
      {saveError && <p className='save-error-text message-auto-hide' onAnimationEnd={() => setSaveError(null)}>{saveError}</p>}
      {saveSuccess && <p className='save-success-text message-auto-hide' onAnimationEnd={() => setSaveSuccess(false)}>Проект успешно обновлён</p>}
    </div>
  )
}

export default Project