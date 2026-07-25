import './project.scss'
import '../common/comment.scss' 

import Add from '@icons/plus.svg?react'
import Delete from '@icons/delete.svg?react'
import Edit from '@icons/edit.svg?react'
import Accept from '@icons/accept.svg?react'
import Reject from '@icons/reject.svg?react'
import ImportantIcon from '@icons/important_warning.svg?react'
import AdminProjectIcon from '@icons/admin_project.svg?react'
import PrivacyIcon from '@icons/private.svg?react'
import PublicIcon from '@icons/public.svg?react'

import { useEffect, useState, useRef, Fragment } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Toggle } from '../common/toggle'
import { validatorFormat, validatorRegex, useChangeInput } from '../scripts/function'
import { useAuth } from '../hooks/useAuth'

import { Dropdown } from '../common/dropdown' 
import { useIsOpen } from '../scripts/function'  
import DropdownIcon from '@icons/dropdown.svg?react'

import { ProjectPreview } from './project_preview'
import { projectsApi, projectDraftApi, type ProjectDraftData } from '../services/project'
import { projectMembersApi } from '../services/project_members'
import { usersApi, type UserData } from '../services/users'
import { vacanciesApi, type VacancyData } from '../services/vacancy'
import { commentApi, type CommentData } from '../services/comment'

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

interface CommentNode extends CommentData {
  replies: CommentNode[];
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
    padding: 0;
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
          <button className='member-edit-badge' onClick={() => onEdit(vacancy)}>
            <Edit className='ico' />
          </button>
          <button className='member-remove-badge' onClick={() => onDelete(vacancy.vacancyId)}>
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
                <button className='member-edit-badge' onClick={handleEditRoleClick}><Edit className='ico' /></button>
              )}
              {onUpdateRole && isEditingRole && (
                <button className='member-accept-badge' onClick={handleAcceptRoleClick} disabled={!editedRole.trim() || editedRole === member.role}><Accept className='ico' /></button>
              )}
              {onUpdateRole && isEditingRole && (
                <button className='member-reject-badge' onClick={(e) => { e.stopPropagation(); setIsEditingRole(false); setEditedRole(member.role); setRoleError(null) }}><Reject className='ico' /></button>
              )}
              {isOwner && (<span className='owner-badge'><AdminProjectIcon className='owner-icon' />Владелец</span>)}
              {!isOwner && onRemove && !isEditingRole && (
                <button className='member-remove-badge' onClick={(e) => { e.stopPropagation(); onRemove() }}><Delete className='ico' /></button>
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
  
  const { userId: currentUserId } = useAuth()

  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [projectRating, setProjectRating] = useState(0)
  const [isPrivate, setIsPrivate] = useState(false)
  
  const [hasBasicInfoDraft, setHasBasicInfoDraft] = useState(false)
  const [hasDescriptionDraft, setHasDescriptionDraft] = useState(false)
  const [hasTeamDraft, setHasTeamDraft] = useState(false)
  const [hasVacanciesDraft, setHasVacanciesDraft] = useState(false)
  
  const [loadedDraft, setLoadedDraft] = useState<ProjectDraftData | null | undefined>(undefined)
  const draftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

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

  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())

  const toggleReplies = (commentId: string) => {
  setExpandedComments(prev => {
    const newSet = new Set(prev)
    if (newSet.has(commentId)) {
      newSet.delete(commentId)
    } else {
      newSet.add(commentId)
    }
    return newSet
  })
}

const isExpanded = (commentId: string) => expandedComments.has(commentId)

  const [initialState, setInitialState] = useState(() => ({
    name: 'Unnamed', shortDesc: '', status: STATUS_OPTIONS[0], description: '', isPrivate: false,
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

  const isOwner = project?.ownerId === currentUserId

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

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ['comments', 'project', projectId],
    queryFn: () => commentApi.getComments('project', projectId!),
    enabled: !!projectId,
  })

  const projectInvites = allInvites.filter(invite => invite.projectId === projectId)

  useEffect(() => {
    setLoadedDraft(undefined)
    teamInitializedRef.current = false
    vacanciesSyncedRef.current = false
  }, [projectId])

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
    if (vacanciesFromDb.length > 0 && !vacanciesSyncedRef.current && loadedDraft !== undefined) {
      let vacancies: LocalVacancy[] = vacanciesFromDb.map(v => ({ ...v } as LocalVacancy))
      const draftVacancies = loadedDraft?.vacancies || []
      const draftDeletedVacancyIds = loadedDraft?.deletedVacancyIds || []

      draftVacancies.forEach(dv => {
        const idx = vacancies.findIndex(v => v.vacancyId === dv.vacancyId)
        if (idx >= 0) {
          vacancies[idx] = { ...vacancies[idx], title: dv.title, description: dv.description, requiredTags: dv.requiredTags, _isModified: dv.isModified }
        } else if (dv.isNew) {
          vacancies.push({ ...dv, projectId: projectId!, role: dv.title, projectTitle: name, ratingCount: 0, _isNew: true } as LocalVacancy)
        }
      })

      vacancies = vacancies.filter(v => !draftDeletedVacancyIds.includes(v.vacancyId))

      setLocalVacancies(vacancies)
      setDeletedVacancyIds(draftDeletedVacancyIds)
      vacanciesSyncedRef.current = true
    }
  }, [vacanciesFromDb, loadedDraft, projectId, name])

  useEffect(() => {
    if (teamMembers.length > 0 && !teamInitializedRef.current && loadedDraft !== undefined) {
      const membersCopy = teamMembers.map(m => ({ ...m }))
      setInitialTeamState(membersCopy)

      const draftDeletedMemberIds = loadedDraft?.deletedMemberIds || []
      const draftEditedRoles = loadedDraft?.editedRoles || {}

      let restored = membersCopy.filter(m => !draftDeletedMemberIds.includes(m.memberId))
      restored = restored.map(m => draftEditedRoles[m.memberId] ? { ...m, role: draftEditedRoles[m.memberId] } : m)

      setLocalTeamMembers(restored)
      setDeletedMemberIds(draftDeletedMemberIds)
      setEditedRoles(draftEditedRoles)
      teamInitializedRef.current = true
    }
  }, [teamMembers, loadedDraft])

  useEffect(() => {
    if (project && projectId) {
      const cleanState = {
        name: project.title,
        shortDesc: project.shortDescription || '',
        status: project.status,
        description: project.fullDescription || '',
        isPrivate: project.isPrivate || false,
      }
      
      setInitialState(cleanState)
      setProjectRating(project.ratingCount || 0)
      
      handleProjectChange({ target: { name: 'name', value: project.title } } as any)
      handleProjectChange({ target: { name: 'shortDesc', value: project.shortDescription || '' } } as any)
      handleProjectChange({ target: { name: 'status', value: project.status } } as any)
      handleProjectChange({ target: { name: 'description', value: project.fullDescription || '' } } as any)

      const statusMap: Record<string, string> = {'in_progress': 'В процессе', 'completed': 'Завершён', 'paused': 'Приостановлен'}

      const loadDraft = async () => {
        try {
          const draft = await projectDraftApi.getDraft(projectId)
          setLoadedDraft(draft)

          if (draft) {
            const draftStatus = draft.status ? (statusMap[draft.status] || draft.status) : cleanState.status
            
            setName(draft.title ?? cleanState.name)
            setShortDesc(draft.shortDescription ?? cleanState.shortDesc)
            setStatus(draftStatus)
            setDescription(draft.fullDescription ?? cleanState.description)
            setIsPrivate(draft.isPrivate ?? cleanState.isPrivate)
            
            setHasBasicInfoDraft(
              (draft.title && draft.title !== cleanState.name) ||
              (draft.shortDescription !== undefined && draft.shortDescription !== cleanState.shortDesc) ||
              (draft.status && draft.status !== cleanState.status) ||
              (draft.isPrivate !== undefined && draft.isPrivate !== cleanState.isPrivate)
            )
            setHasDescriptionDraft(!!(draft.fullDescription && draft.fullDescription !== cleanState.description))
          } else {
            const projectStatus = project.status ? (statusMap[project.status] || project.status) : STATUS_OPTIONS[0]
            
            setName(cleanState.name)
            setShortDesc(cleanState.shortDesc)
            setStatus(projectStatus)
            setDescription(cleanState.description)
            setIsPrivate(cleanState.isPrivate)
            
            setHasBasicInfoDraft(false)
            setHasDescriptionDraft(false)
          }
        }
        catch (error) {
          console.error('Ошибка загрузки черновика:', error)
          setLoadedDraft(null)
          const projectStatus = project.status ? (statusMap[project.status] || project.status) : STATUS_OPTIONS[0]
          setName(cleanState.name)
          setShortDesc(cleanState.shortDesc)
          setStatus(projectStatus)
          setDescription(cleanState.description)
          setIsPrivate(cleanState.isPrivate)
        }
      }
      loadDraft()
    }
  }, [project, projectId])

  const reverseStatusMap: Record<string, string> = {'В процессе': 'in_progress','Завершён': 'completed','Приостановлен': 'paused'}

  useEffect(() => {
    if (!projectId) return

    const isBasicInfoChanged = 
      name !== initialState.name ||
      shortDesc !== initialState.shortDesc ||
      status !== initialState.status ||
      isPrivate !== initialState.isPrivate

    const isDescriptionChanged = description !== initialState.description
    const isTeamChanged = deletedMemberIds.length > 0 || Object.keys(editedRoles).length > 0
    const isVacanciesChanged = deletedVacancyIds.length > 0 || localVacancies.some(v => v._isNew || v._isModified)

    if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current)

    if (!isBasicInfoChanged && !isDescriptionChanged && !isTeamChanged && !isVacanciesChanged) return

    draftTimeoutRef.current = setTimeout(async () => {
      try {
        await projectDraftApi.saveDraft(projectId, {
          title: name,
          shortDescription: shortDesc,
          fullDescription: description,
          status: reverseStatusMap[status] || status,
          isPrivate: isPrivate,
          vacancies: localVacancies
            .filter(v => v._isNew || v._isModified)
            .map(v => ({
              vacancyId: v.vacancyId,
              title: v.title,
              description: v.description,
              requiredTags: v.requiredTags || [],
              isNew: !!v._isNew,
              isModified: !!v._isModified,
            })),
          deletedVacancyIds,
          deletedMemberIds,
          editedRoles,
        })

        if (isBasicInfoChanged) setHasBasicInfoDraft(true)
        if (isDescriptionChanged) setHasDescriptionDraft(true)
      } catch (error) {
        console.error('Ошибка автосохранения черновика:', error)
      }
    }, 1000)

    return () => {
      if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current)
    }
  }, [name, shortDesc, status, description, isPrivate, localVacancies, deletedVacancyIds, deletedMemberIds, editedRoles, initialState, projectId, vacanciesFromDb])

  useEffect(() => {
    const hasRealChanges = 
      deletedMemberIds.length > 0 || 
      Object.keys(editedRoles).some(memberId => {
        const originalMember = initialTeamState.find(m => m.memberId === memberId)
        return originalMember && originalMember.role !== editedRoles[memberId]
      })
    
    setHasTeamDraft(hasRealChanges)
  }, [deletedMemberIds, editedRoles, initialTeamState])

  useEffect(() => {
    const hasRealChanges = 
      deletedVacancyIds.length > 0 || 
      localVacancies.some(v => {
        if (v._isNew) return true
        
        const originalVacancy = vacanciesFromDb.find(orig => orig.vacancyId === v.vacancyId)
        
        if (!originalVacancy && !v._isNew) return true
        
        if (originalVacancy) {
          return (
            v.title !== originalVacancy.title ||
            v.description !== originalVacancy.description ||
            JSON.stringify(v.requiredTags || []) !== JSON.stringify(originalVacancy.requiredTags || [])
          )
        }
        
        return false
      })
    
    setHasVacanciesDraft(hasRealChanges)
  }, [deletedVacancyIds, localVacancies, vacanciesFromDb])

  useEffect(() => {
    const isBasicInfoChanged = 
      name !== initialState.name ||
      shortDesc !== initialState.shortDesc ||
      status !== initialState.status ||
      isPrivate !== initialState.isPrivate

    if (!isBasicInfoChanged && hasBasicInfoDraft) {
      setHasBasicInfoDraft(false)
    }
  }, [name, shortDesc, status, isPrivate, initialState, hasBasicInfoDraft])

  useEffect(() => {
    if (description === initialState.description && hasDescriptionDraft) {
      setHasDescriptionDraft(false)
    }
  }, [description, initialState.description, hasDescriptionDraft])

  const hasVacancyChanges = 
  deletedVacancyIds.length > 0 || 
  localVacancies.some(v => {
    if (v._isNew) return true
    
    const originalVacancy = vacanciesFromDb.find(orig => orig.vacancyId === v.vacancyId)
    
    if (!originalVacancy && !v._isNew) return true
    
    if (originalVacancy) {
      return (
        v.title !== originalVacancy.title ||
        v.description !== originalVacancy.description ||
        JSON.stringify(v.requiredTags || []) !== JSON.stringify(originalVacancy.requiredTags || [])
      )
    }
    
    return false
  });

  const hasTeamChanges = 
    deletedMemberIds.length > 0 || 
    Object.keys(editedRoles).some(memberId => {
      const originalMember = initialTeamState.find(m => m.memberId === memberId)
      return originalMember && originalMember.role !== editedRoles[memberId]
    });

  const hasChanges = 
    name !== initialState.name ||
    shortDesc !== initialState.shortDesc ||
    status !== initialState.status ||
    description !== initialState.description ||
    isPrivate !== initialState.isPrivate ||
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
      .then(() => {})
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

  const handleCancel = async () => { 
    if (hasChanges && projectId) {
      try {
        await projectDraftApi.discardDraft(projectId)
      } catch (error) {
        console.error('Ошибка сброса черновика:', error)
      }
    }
    
    setName(initialState.name)
    setShortDesc(initialState.shortDesc)
    setStatus(initialState.status)
    setDescription(initialState.description)
    setIsPrivate(initialState.isPrivate)
    
    setHasBasicInfoDraft(false)
    setHasDescriptionDraft(false)
    setHasTeamDraft(false)
    setHasVacanciesDraft(false)
    
    setLocalTeamMembers(initialTeamState.map(m => ({ ...m })))
    setDeletedMemberIds([])
    setEditedRoles({})
    setLocalVacancies(vacanciesFromDb.map(v => ({ ...v })))
    setDeletedVacancyIds([])
  }
  
  const handleBack = async () => { 
    if (hasChanges && projectId) {
      try {
        await projectDraftApi.discardDraft(projectId)
      } catch (error) {
        console.error('Ошибка сброса черновика:', error)
      }
    }
    
    if (onCancel) { onCancel(); return } 
    navigate(`${profilePath}/activity`, { replace: true }) 
  }

  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBack()
      }
    }

    window.addEventListener('keydown', handleEscKey)
  
    return () => {
      window.removeEventListener('keydown', handleEscKey)
    }
  }, [handleBack])

  const handleSave = async () => {
    if (!projectId || !hasChanges || !isProjectFormValid) return
    setIsSaving(true)
    setSaveError(null)

    try {
      await projectDraftApi.commitDraft(projectId, {
        title: name,
        shortDescription: shortDesc,
        fullDescription: description,
        status: reverseStatusMap[status] || status,
        isPrivate: isPrivate
      })

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
      setLoadedDraft(undefined)

      setInitialState({ name, shortDesc, status, description, isPrivate })
      
      setHasBasicInfoDraft(false)
      setHasDescriptionDraft(false)
      setHasTeamDraft(false)
      setHasVacanciesDraft(false)
      
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Не удалось сохранить проект'
      setSaveError(msg)
      setTimeout(() => setSaveError(null), 3000)
    } finally {
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

    const originalRole = initialTeamState.find(m => m.memberId === memberId)?.role

    setEditedRoles(prev => {
      const newRoles = { ...prev }
      if (originalRole !== undefined && newRole === originalRole) {
        delete newRoles[memberId]
      } else {
        newRoles[memberId] = newRole
      }
      return newRoles
    })
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

  const createCommentMutation = useMutation({
    mutationFn: (dto: any) => commentApi.create(dto),
    onSuccess: () => {
      refetchComments();
      setNewComment('');
      setReplyingTo(null);
      setReplyContent('');
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string, content: string }) => commentApi.update(commentId, content),
    onSuccess: () => {
      refetchComments();
      setEditingCommentId(null);
      setEditContent('');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => commentApi.delete(commentId),
    onSuccess: () => {
      refetchComments();
    },
  });

  const buildCommentTree = (commentsList: CommentData[]): CommentNode[] => {
    const map = new Map<string, CommentNode>();
    const roots: CommentNode[] = [];

    commentsList.forEach(c => {
      map.set(c.commentId, { ...c, replies: [] });
    });

    commentsList.forEach(c => {
      const node = map.get(c.commentId)!;
      if (c.parentCommentId && map.has(c.parentCommentId)) {
        map.get(c.parentCommentId)!.replies.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const renderCommentNode = (node: CommentNode, depth = 0) => {
  const isAuthor = node.userId === currentUserId;
  const canDelete = isAuthor || isOwner;
  const canEdit = isAuthor;
  const hasReplies = node.replies.length > 0;
  const expanded = isExpanded(node.commentId);

  return (
    <div key={node.commentId} className={`comment-item ${depth > 0 ? 'comment-reply' : ''}`}>
      <div className='comment-wrapper'>
        <div className='comment-avatar'>
          <img src={node.avatarUrl || '/default-avatar.png'} alt={node.nickname || 'User'} />
        </div>
        
        <div className='comment-body'>
          <div className='comment-header'>
            <div className='comment-meta'>
              <span className='comment-author'>@{node.nickname || 'deleted_user'}</span>
              <span className='comment-date'>{new Date(node.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date(node.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              {node.isEdited && <span className='comment-edited'>• изменено</span>}
            </div>
            
            {!node.isDeleted && (
              <div className='comment-actions-right'>
                {canEdit && (
                  <button 
                    className='comment-edit-badge' 
                    onClick={() => {
                      setReplyingTo(null)
                      setReplyContent('')
                      setEditingCommentId(node.commentId)
                      setEditContent(node.content || '')
                    }}
                  >
                    <Edit className='ico' />
                  </button>
                )}
                {canDelete && (
                  <button 
                    className='comment-remove-badge' 
                    onClick={() => {
                      if (window.confirm('Удалить этот комментарий?')) {
                        deleteCommentMutation.mutate(node.commentId)
                      }
                    }}
                  >
                    <Delete className='ico' />
                  </button>
                )}
              </div>
            )}
          </div>
          
          {node.isDeleted ? (
            <div className='comment-content deleted'>Комментарий удален</div>
          ) : (
            <div className='comment-content'>{node.content}</div>
          )}

<div className='comment-actions-left'>
  {!node.isDeleted && (
    <button 
      className='comment-action-text' 
      onClick={() => {
        setEditingCommentId(null)
        setEditContent('')
        setReplyingTo(replyingTo === node.commentId ? null : node.commentId)
      }}
    >
      Ответить
    </button>
  )}
  {hasReplies && (
    <button 
      className='comment-action-text expand-replies'
      onClick={() => toggleReplies(node.commentId)}
    >
      {expanded ? 'Скрыть ответы' : `${node.replies.length} ${node.replies.length === 1 ? 'ответ' : node.replies.length < 5 ? 'ответа' : 'ответов'}`}
      <span className={`expand-icon ${expanded ? 'expanded' : ''}`}>▾</span>
    </button>
  )}
</div>

          {replyingTo === node.commentId && (
            <div className='comment-reply-input'>
              <textarea
                className='comment-textarea small'
                placeholder={`Ответ для @${node.nickname}...`}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
              />
              <div className='comment-form-actions'>
                <button 
                  className='comment-btn confirm'
                  onClick={() => createCommentMutation.mutate({
                    referenceType: 'project',
                    referenceId: projectId!,
                    content: replyContent,
                    parentCommentId: node.commentId
                  })} 
                  disabled={!replyContent.trim() || createCommentMutation.isPending}
                >
                  Ответить
                </button>
                <button 
                  className='comment-btn cancel'
                  onClick={() => {
                    setReplyingTo(null)
                    setReplyContent('')
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {editingCommentId === node.commentId && (
            <div className='comment-edit-input'>
              <textarea
                className='comment-textarea small'
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
              <div className='comment-form-actions'>
                <button 
                  className='comment-btn confirm'
                  onClick={() => updateCommentMutation.mutate({ commentId: node.commentId, content: editContent })} 
                  disabled={!editContent.trim() || updateCommentMutation.isPending}
                >
                  Изменить
                </button>
                <button 
                  className='comment-btn cancel'
                  onClick={() => {
                    setEditingCommentId(null)
                    setEditContent('')
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {hasReplies && expanded && (
        <div className='comment-replies'>
          {node.replies.map(reply => renderCommentNode(reply, depth + 1))}
        </div>
      )}
    </div>
  );
};

  return (
    <div className='project-page'>
      {isPreview ? (
        <ProjectPreview name={name} shortDesc={shortDesc} status={status} description={description} team={localTeamMembers} vacancies={localVacancies} isOwner={true} ratingCount={projectRating} isPrivate={isPrivate} comments={comments} />
      ) : (
        <>
          <section className='project-section'>
            <div className='section-header-wrapper'>
              <h2 className='project-section-title'>Базовая информация</h2>
              {hasBasicInfoDraft && <span className='draft-indicator'>(черновик)</span>}
            </div>
            <div className='project-form-grid'>
              <div className='project-field-row'>
                <label className='project-field-label'>Название проекта: <span className='required-mark'>*</span></label>
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
                <textarea 
                  name="shortDesc"
                  className={`project-short-desc-editor ${projectTouched.shortDesc && projectDirty.shortDesc && checkProjectFormat('shortDesc', shortDesc) ? 'input-error' : ''}`} 
                  value={shortDesc} 
                  onChange={e => {
                    if (e.target.value.length > 150) return;
                    setShortDesc(e.target.value)
                    handleProjectChange(e)
                  }} 
                  onBlur={handleProjectBlur}
                  maxLength={150}
                  placeholder='Кратко опишите суть проекта в 1-2 предложениях'
                />
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
              <div className='project-field-row'>
                <label className='project-field-label'>Приватность:</label>
                <div className='privacy-toggle-container'>
                  <button 
                    className='privacy-toggle-btn' 
                    onClick={() => setIsPrivate(!isPrivate)}
                    type="button"
                  >
                    {isPrivate ? <PrivacyIcon className='lock-ico' /> : <PublicIcon className='lock-ico unlocked' />}
                    <span>{isPrivate ? 'Приватный' : 'Публичный'}</span>
                  </button>
                  <p className='privacy-hint'>
                    {isPrivate 
                      ? 'Только участники команды могут видеть проект' 
                      : 'Проект виден всем пользователям'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className='project-section'>
            <div className='section-header-wrapper'>
              <h2 className='project-section-title'>Описание проекта</h2>
              {hasDescriptionDraft && <span className='draft-indicator'>(черновик)</span>}
            </div>
            <textarea className='project-md-editor' value={description} onChange={e => setDescription(e.target.value)} placeholder={'### Заголовок проекта\n\nРасскажите о целях и задачах вашего проекта.\n\nИспользуйте **жирный текст** для акцентов и списки для структуры.\n\nПример:\n- Цель проекта\n- Задачи\n- Ожидаемые результаты'} />
          </section>

          <section className='project-section'>
            <div className='section-header-wrapper'>
              <h2 className='project-section-title'>
                Команда: <span className='project-count'>{localTeamMembers.length}</span>
              </h2>
              {hasTeamDraft && <span className='draft-indicator'>(черновик)</span>}
            </div>
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
            <div className='section-header-wrapper'>
              <h2 className='project-section-title'>
                Заявки: <span className='project-count'>{localVacancies.length}</span>
              </h2>
              {hasVacanciesDraft && <span className='draft-indicator'>(черновик)</span>}
            </div>
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

           <section className='project-section'>
            <h2 className='project-section-title'>
              Комментарии: <span className='project-count'>{comments.length}</span>
            </h2>
            
            <div className='comment-input-wrapper'>
              <textarea
                className='comment-textarea'
                placeholder='Место для твоего коммментария...'
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button
                className='comment-btn send'
                onClick={() => createCommentMutation.mutate({ referenceType: 'project', referenceId: projectId!, content: newComment })}
                disabled={!newComment.trim() || createCommentMutation.isPending}
              >
                Отправить
              </button>
            </div>

            <div className='comments-list'>
              {comments.length === 0 ? (
                <p className='no-comments-text'>Пока нет комментариев. Будьте первым!</p>
              ) : (
                buildCommentTree(comments).map(node => renderCommentNode(node))
              )}
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