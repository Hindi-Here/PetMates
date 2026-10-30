import './project.scss'
import '../common/comment.scss'
import Add from '@icons/plus.svg?react'
import Delete from '@icons/delete.svg?react'
import Edit from '@icons/edit.svg?react'
import Accept from '@icons/accept.svg?react'
import Reject from '@icons/reject.svg?react'
import ImportantIcon from '@icons/important_warning.svg?react'
import PrivacyIcon from '@icons/private.svg?react'
import PublicIcon from '@icons/public.svg?react'
import InfoCircleIcon from '@icons/info_circle.svg?react'
import InfoIcon from '@icons/info.svg?react'
import DropdownIcon from '@icons/dropdown.svg?react'
import CopyIcon from '@icons/copy.svg?react'
import RejectIcon from '@icons/reject.svg?react'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Toggle } from '../common/toggle'
import { Dropdown } from '../common/dropdown'
import { validatorFormat, validatorRegex, useChangeInput, useIsOpen } from '../scripts/function'
import { useAuth } from '../hooks/useAuth'
import { useDraftAutosave } from '../hooks/useDraftAutosave'
import { ProjectPublicView } from './project_public_view'
import { projectsApi, projectDraftApi, type ProjectDraftData } from '../services/project'
import { projectMembersApi } from '../services/project_members'
import { usersApi, type UserData } from '../services/users'
import { vacanciesApi, type VacancyData } from '../services/vacancy'
import { responseApi, type ResponseData } from '../services/response'
import { inviteApi, type InviteData } from '../services/invite'
import DeleteProjectForm from '../forms/delete_project'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { UserCard } from '../common/userCard'
import { LIMITS, TIMING, maxChars, minChars } from '../scripts/limits'
import { STALE } from '../scripts/query/queryClient'
import { invalidateProjects, invalidateRelations } from '../scripts/query/invalidate'
import { CommentsSection } from '../common/commentsSection'
import { Markdown } from '../common/markdown'
import { useOnce } from '../hooks/useOnce'

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
const reverseStatusMap: Record<string, string> = { 'В процессе': 'in_progress', 'Завершён': 'completed', 'Приостановлен': 'paused' }

const getVisualLineCount = (text: string, element: HTMLElement) => {
  const computed = window.getComputedStyle(element)
  const lineHeight = parseFloat(computed.lineHeight)
  if (isNaN(lineHeight)) return text.split('\n').length
  const mirror = document.createElement('div')
  mirror.style.cssText = `position: absolute; visibility: hidden; height: auto; width: ${element.clientWidth}px; font-family: ${computed.fontFamily}; font-size: ${computed.fontSize}; font-weight: ${computed.fontWeight}; line-height: ${computed.lineHeight}; white-space: pre-wrap; word-wrap: break-word; padding: 0; box-sizing: border-box;`
  mirror.textContent = text || '.'
  document.body.appendChild(mirror)
  const height = mirror.offsetHeight
  document.body.removeChild(mirror)
  return Math.ceil(height / lineHeight)
}

// Рендер карточки вакансии
const VacancyCard = ({
  vacancy,
  onEdit,
  onDelete
}: {
  vacancy: LocalVacancy
  onEdit: (v: LocalVacancy) => void
  onDelete: (id: string) => void
}) => (
  <div className='vacancy-card'>
    <div className='vacancy-card-header'>
      <div className='vacancy-header-left'>
        <p className='vacancy-title'>{vacancy.title}</p>
        <p className='vacancy-project-name'>{vacancy.projectTitle || 'PetMates'}</p>
      </div>
      <div className='vacancy-actions'>
        <button className='icon-btn' onClick={() => onEdit(vacancy)}>
          <Edit className='ico' />
        </button>
        <button className='icon-btn danger' onClick={() => onDelete(vacancy.vacancyId)}>
          <Reject className='ico' />
        </button>
      </div>
    </div>
    <p className='vacancy-description'>{vacancy.description}</p>
    {vacancy.requiredTags && vacancy.requiredTags.length > 0 && (
      <div className='vacancy-tags'>
        {vacancy.requiredTags.map((tag, index) => (
          <span key={index} className='vacancy-tag'>{tag}</span>
        ))}
      </div>
    )}
  </div>
)

// Рендер карточки участника команды
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
  const user = member.userData
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
      [!validatorFormat.maxLength(value, LIMITS.member.roleMax), maxChars(LIMITS.member.roleMax)],
      [value.length > 0 && value.length < LIMITS.member.roleMin, minChars(LIMITS.member.roleMin)],
    ]
    const error = rules.find(([isInvalid]) => isInvalid)
    return error?.[1] ?? null
  }

  if (!user) return null

  const isBanned = user?.isBanned === true

  const startEdit = () => {
    setIsEditingRole(true)
    setEditedRole(member.role)
    setRoleError(null)
  }

  const cancelEdit = () => {
    setIsEditingRole(false)
    setEditedRole(member.role)
    setRoleError(null)
  }

  const acceptEdit = () => {
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
    if (e.key === 'Enter') acceptEdit()
    else if (e.key === 'Escape') {
      e.stopPropagation()
      cancelEdit()
    }
  }

  const actions = (
    <>
      {onUpdateRole && !isEditingRole && !isBanned && (
        <button className='member-edit-badge' onClick={startEdit}>
          <Edit className='ico' />
        </button>
      )}
      {onUpdateRole && isEditingRole && !isBanned && (
        <>
          <button
            className='member-accept-badge'
            onClick={acceptEdit}
            disabled={!editedRole.trim() || editedRole === member.role}
          >
            <Accept className='ico' />
          </button>
          <button className='member-reject-badge' onClick={cancelEdit}>
            <Reject className='ico' />
          </button>
        </>
      )}
      {!isOwner && onRemove && !isEditingRole && (
        <button className='member-remove-badge' onClick={onRemove}>
          <Reject className='ico' />
        </button>
      )}
    </>
  )

  const roleEditor = (
    <>
      <input
        ref={roleInputRef}
        className={`role-input ${roleError ? 'input-error' : ''}`}
        value={editedRole}
        onChange={e => { setEditedRole(e.target.value); if (roleError) setRoleError(null) }}
        onKeyDown={handleRoleKeyDown}
        placeholder='Роль'
        maxLength={LIMITS.member.roleMax}
      />
      {roleError && <p className='field-error-text'>{roleError}</p>}
    </>
  )

  return (
    <UserCard
      user={user}
      isOwner={isOwner}
      role={member.role}
      disabledInvite={true}
      showModerationMenu={false}
      actions={actions}
      roleSlot={isEditingRole ? roleEditor : undefined}
    />
  )
}

interface ProjectProps { onCancel?: () => void }

export const Project = ({ onCancel }: ProjectProps) => {
  const navigate = useNavigate()
  const { projectId, profileId } = useParams<{ projectId: string; profileId: string }>()
  const profilePath = profileId ? `/profile/${profileId}` : '/profile'
  const { userId: currentUserId } = useAuth()
  const queryClient = useQueryClient()

  const [isPreview, setIsPreview] = useState(false)
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
  const [name, setName] = useState('Unnamed')
  const [shortDesc, setShortDesc] = useState('')
  const [status, setStatus] = useState(STATUS_OPTIONS[0])
  const { isOpen: isStatusOpen, setIsOpen: setStatusOpen, menuRef: statusMenuRef } = useIsOpen()
  const statusOptions = STATUS_OPTIONS.map(s => ({ id: s, label: s }))
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
  const [showDeleteForm, setShowDeleteForm] = useState(false)
  const [isPreviewDescription, setIsPreviewDescription] = useState(false)
  const [initialState, setInitialState] = useState(() => ({
    name: 'Unnamed', shortDesc: '', status: STATUS_OPTIONS[0], description: '', isPrivate: false,
  }))
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [projectMedia, setProjectMedia] = useState<Array<{
    name: string;
    url: string;
    size: number;
    uploadedAt: string;
    isDraft: boolean;
  }>>([])
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [deletedMediaFileNames, setDeletedMediaFileNames] = useState<string[]>([])

  const hasMediaChanges = useMemo(() => {
    return deletedMediaFileNames.length > 0
  }, [deletedMediaFileNames])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Б'
    const k = 1024
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getTotalMediaSize = () => {
    return projectMedia.reduce((acc, media) => acc + media.size, 0)
  }

  const insertAtCursor = (textToInsert: string) => {
    const textarea = descriptionTextareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = description.slice(0, start) + textToInsert + description.slice(end)
    setDescription(newValue)
    requestAnimationFrame(() => {
      textarea.focus()
      const newPos = start + textToInsert.length
      textarea.setSelectionRange(newPos, newPos)
    })
  }

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !projectId) return

    const currentTotalSize = getTotalMediaSize()
    if (currentTotalSize + file.size > LIMITS.upload.mediaTotalMaxBytes) {
      setMediaError(`Общий размер вложений не должен превышать ${LIMITS.upload.mediaTotalMaxBytes / 1024 / 1024} МБ`)
      setTimeout(() => setMediaError(null), TIMING.toastMs)
      return
    }

    setIsUploadingMedia(true)
    try {
      const { url } = await projectDraftApi.uploadDraftMedia(projectId, file)
      insertAtCursor(`\n<img src="${url}" width="400" />\n`)
      const media = await projectsApi.getMedia(projectId)
      setProjectMedia(media)
    } catch (error) {
      console.error('Ошибка загрузки изображения:', error)
      setMediaError('Не удалось загрузить изображение')
      setTimeout(() => setMediaError(null), TIMING.toastMs)
    } finally {
      setIsUploadingMedia(false)
    }
  }

  const handleInsertMedia = (url: string) => {
    insertAtCursor(`\n<img src="${url}" width="400" />\n`)
  }

  const handleDeleteMedia = async (fileName: string, fileUrl: string, isDraft: boolean) => {
    if (!projectId) return
    try {
      await projectDraftApi.deleteMedia(projectId, fileName)
      const escapedUrl = fileUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const imgTagRegex = new RegExp(`<img\\s+[^>]*src=["']${escapedUrl}["'][^>]*>\\s*`, 'gi')
      setDescription(prev => prev.replace(imgTagRegex, ''))
      if (!isDraft) {
        setDeletedMediaFileNames(prev => [...prev, fileName])
      }
      const media = await projectsApi.getMedia(projectId)
      setProjectMedia(media)
    } catch (error) {
      console.error('Ошибка удаления:', error)
    }
  }

  useEffect(() => {
    if (projectId) {
      projectsApi.getMedia(projectId)
        .then(setProjectMedia)
        .catch(console.error)
    }
  }, [projectId])

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
      name: (val: string) => validatorRegex.text(val, LIMITS.project.titleMax),
      shortDesc: (val: string) => validatorRegex.text(val, LIMITS.project.shortDescriptionMax),
      status: (val: string) => val,
      description: (val: string) => validatorRegex.message(val),
    }
  )

    const checkProjectFormat = (fieldName: string, value: string): string | null => {
    const rules: Record<string, Array<[boolean, string]>> = {
      name: [
        [!validatorFormat.required(value), 'Введите название проекта'],
        [!validatorFormat.maxLength(value, LIMITS.project.titleMax), maxChars(LIMITS.project.titleMax)]
      ],
      shortDesc: [
        [!validatorFormat.maxLength(value, LIMITS.project.shortDescriptionMax), maxChars(LIMITS.project.shortDescriptionMax)]
      ],
    }
    const fieldRules = rules[fieldName as keyof typeof rules]
    if (!fieldRules)
      return null
    const error = fieldRules.find(([isInvalid]) => isInvalid)
    return error?.[1] ?? null
  }

  const checkRoleFormat = (value: string): string | null => {
    const rules: Array<[boolean, string]> = [
      [!validatorFormat.required(value), 'Введите роль'],
      [!validatorFormat.maxLength(value, LIMITS.member.roleMax), maxChars(LIMITS.member.roleMax)],
      [value.length > 0 && value.length < LIMITS.member.roleMin, minChars(LIMITS.member.roleMin)],
    ]
    const error = rules.find(([isInvalid]) => isInvalid)
    return error?.[1] ?? null
  }

  const checkVacancyFormat = (fieldName: string, value: string): string | null => {
    const rules: Record<string, Array<[boolean, string]>> = {
      vacTitle: [
        [!validatorFormat.required(value), 'Введите название роли'],
        [value.trim().length > 0 && value.trim().length < LIMITS.member.roleMin, minChars(LIMITS.member.roleMin)],
        [!validatorFormat.maxLength(value, LIMITS.vacancy.titleMax), maxChars(LIMITS.vacancy.titleMax)]
      ],
      vacDesc: [
        [!validatorFormat.required(value), 'Введите описание'],
        [!validatorFormat.maxLength(value, LIMITS.vacancy.descriptionMax), maxChars(LIMITS.vacancy.descriptionMax)]
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

  const { data: project } = useQuery({
    queryKey: queryKeys.projects.byId(projectId!),
    queryFn: () => projectsApi.getProject(projectId!),
    enabled: !!projectId,
    staleTime: STALE.none,
    refetchOnWindowFocus: false,
  })

  const isOwner = project?.ownerId === currentUserId

  const { data: teamMembers = [] } = useQuery<TeamMemberWithUser[]>({
    queryKey: queryKeys.projects.team(projectId!),
    queryFn: async () => {
      if (!projectId) return []
      const members = await projectMembersApi.getByProject(projectId)
    
      const proj = await queryClient.ensureQueryData({
        queryKey: queryKeys.projects.byId(projectId),
        queryFn: () => projectsApi.getProject(projectId),
      })

      const membersWithUsers: TeamMemberWithUser[] = members.map((member) => ({
        memberId: member.memberId,
        projectId: member.projectId,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        isOwner: member.userId === proj.ownerId,
        userData: {
          userId: member.userId,
          nickname: member.nickname,
          avatarUrl: member.avatarUrl,
          realName: member.realName,
          age: member.age,
          city: member.city,
          workplace: member.workplace,
          profileRole: member.profileRole,
          systemRole: member.systemRole,
          isBanned: member.isBanned,
          hardSkills: member.hardSkills,
          softSkills: member.softSkills,
          lastOnlineAt: member.lastOnlineAt,
          isOnline: member.isOnline,
          lastSeen: member.lastSeen
        } as UserData
      }))
      return membersWithUsers.sort((a: TeamMemberWithUser, b: TeamMemberWithUser) => {
        if (!a.joinedAt || !b.joinedAt) return 0
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
      })
    },
    enabled: !!projectId,
    staleTime: STALE.none,
  })

  const { data: vacanciesFromDb = [] } = useQuery({
    queryKey: queryKeys.vacancies.byProject(projectId!),
    queryFn: () => vacanciesApi.getByProject(projectId!),
    enabled: !!projectId,
    staleTime: STALE.none,
  })

  const { data: responses = [] } = useQuery({
    queryKey: queryKeys.responses.byProject(projectId!),
    queryFn: () => responseApi.getByProject(projectId!),
    enabled: !!projectId,
    staleTime: STALE.none,
  })

  const { data: allInvites = [] } = useQuery({
    queryKey: queryKeys.invites.outgoing(profileId || ''),
    queryFn: () => inviteApi.getOutgoing(),
    enabled: !!profileId,
    staleTime: STALE.none,
  })

  const projectInvites = useMemo(() =>
    allInvites.filter(invite => invite.projectId === projectId),
    [allInvites, projectId]
  ) 

  useEffect(() => {
    setLoadedDraft(undefined)
    teamInitializedRef.current = false
    vacanciesSyncedRef.current = false
  }, [projectId])

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
      handleProjectChange({ target: { name: 'name', value: project.title } } as unknown as React.ChangeEvent<HTMLInputElement>)
      handleProjectChange({ target: { name: 'shortDesc', value: project.shortDescription || '' } } as unknown as React.ChangeEvent<HTMLInputElement>)
      handleProjectChange({ target: { name: 'status', value: project.status } } as unknown as React.ChangeEvent<HTMLInputElement>)
      handleProjectChange({ target: { name: 'description', value: project.fullDescription || '' } } as unknown as React.ChangeEvent<HTMLInputElement>)

      const statusMap: Record<string, string> = { 'in_progress': 'В процессе', 'completed': 'Завершён', 'paused': 'Приостановлен' }

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
            setDeletedMediaFileNames(draft.deletedMediaFiles || [])
          } else {
            const projectStatus = project.status ? (statusMap[project.status] || project.status) : STATUS_OPTIONS[0]
            setName(cleanState.name)
            setShortDesc(cleanState.shortDesc)
            setStatus(projectStatus)
            setDescription(cleanState.description)
            setIsPrivate(cleanState.isPrivate)
            setHasBasicInfoDraft(false)
            setHasDescriptionDraft(false)
            setDeletedMediaFileNames([])
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
          setDeletedMediaFileNames([])
        }
      }
      loadDraft()
    }
  }, [project, projectId])

  const isBasicInfoChanged =
    name !== initialState.name ||
    shortDesc !== initialState.shortDesc ||
    status !== initialState.status ||
    isPrivate !== initialState.isPrivate

  const isDescriptionChanged = description !== initialState.description
  const isTeamChanged = deletedMemberIds.length > 0 || Object.keys(editedRoles).length > 0
  const isVacanciesChanged = deletedVacancyIds.length > 0 || localVacancies.some(v => v._isNew || v._isModified)
  const hasAnyChanges = isBasicInfoChanged || isDescriptionChanged || isTeamChanged || isVacanciesChanged

  const draftPayload = {
    title: name,
    shortDescription: shortDesc,
    fullDescription: description,
    status: reverseStatusMap[status] || status,
    isPrivate,
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
    deletedMediaFiles: deletedMediaFileNames,
  }

  useDraftAutosave({
    enabled: !!projectId,
    hasChanges: hasAnyChanges,
    payload: draftPayload,
    save: payload => projectDraftApi.saveDraft(projectId!, payload),
    onSaved: () => {
      if (isBasicInfoChanged) setHasBasicInfoDraft(true)
      if (isDescriptionChanged) setHasDescriptionDraft(true)
    },
  })

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
    if (hasBasicInfoDraft) {
      setHasBasicInfoDraft(false)
    }
  }, [name, shortDesc, status, isPrivate, initialState, hasBasicInfoDraft])

  useEffect(() => {
    if (!isBasicInfoChanged && hasBasicInfoDraft) setHasBasicInfoDraft(false)
  }, [isBasicInfoChanged, hasBasicInfoDraft])

  useEffect(() => {
    if (description === initialState.description && hasDescriptionDraft) {
      setHasDescriptionDraft(false)
    }
  }, [description, initialState.description, hasDescriptionDraft])

  const hasVacancyChanges = useMemo(() =>
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
    }),
    [deletedVacancyIds, localVacancies, vacanciesFromDb]
  )

  const hasTeamChanges = useMemo(() =>
    deletedMemberIds.length > 0 ||
    Object.keys(editedRoles).some(memberId => {
      const originalMember = initialTeamState.find(m => m.memberId === memberId)
      return originalMember && originalMember.role !== editedRoles[memberId]
    }),
    [deletedMemberIds, editedRoles, initialTeamState]
  )

  const hasChanges = useMemo(() =>
    name !== initialState.name ||
    shortDesc !== initialState.shortDesc ||
    status !== initialState.status ||
    description !== initialState.description ||
    isPrivate !== initialState.isPrivate ||
    hasVacancyChanges ||
    hasTeamChanges ||
    hasMediaChanges,
    [
      name, shortDesc, status, description, isPrivate, initialState,
      hasVacancyChanges, hasTeamChanges, hasMediaChanges
    ]
  )

  const isProjectFormValid = useMemo(() => {
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
    const descriptionValid = description.length <= LIMITS.longTextMax
    return nameValid && shortDescValid && vacanciesValid && descriptionValid
  }, [name, shortDesc, localVacancies, deletedVacancyIds, description])

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
    setDeletedMediaFileNames([])
    if (projectId) {
      const media = await projectsApi.getMedia(projectId)
      setProjectMedia(media)
    }
  }

  const handleBack = () => {
    if (onCancel) { onCancel(); return }
    navigate(`${profilePath}/activity`, { replace: true })
  }

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('.dark-area-container')) return
      handleBack()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [profilePath, onCancel])

  const savingRef = useRef(false)
  const handleSave = async () => {
    if (savingRef.current || !projectId || !hasChanges || !isProjectFormValid) return
    savingRef.current = true
    setIsSaving(true)
    setSaveError(null)
    try {
      const commitResponse = await projectDraftApi.commitDraft(projectId, {
        title: name,
        shortDescription: shortDesc,
        fullDescription: description,
        status: reverseStatusMap[status] || status,
        isPrivate: isPrivate
      })
      if (commitResponse?.fullDescription !== undefined) {
        setDescription(commitResponse.fullDescription)
      }
      setDeletedMediaFileNames([])
      const media = await projectsApi.getMedia(projectId)
      setProjectMedia(media)

      if (deletedVacancyIds.length > 0) {
        await Promise.all(deletedVacancyIds.filter(id => !id.startsWith('temp_')).map(id => vacanciesApi.delete(id)))
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
        await Promise.all(deletedMemberIds.map(memberId => projectMembersApi.removeMember(memberId)))
        setDeletedMemberIds([])
      }

      const roleUpdates = Object.entries(editedRoles).map(([memberId, newRole]) => ({
        memberId,
        newRole
      }))
      if (roleUpdates.length > 0) {
        await Promise.all(roleUpdates.map(({ memberId, newRole }) => projectMembersApi.updateMemberRole(memberId, newRole)))
        setEditedRoles({})
      }

      await invalidateProjects(queryClient)

      teamInitializedRef.current = false
      vacanciesSyncedRef.current = false
      setLoadedDraft(undefined)
      setInitialState({
        name,
        shortDesc,
        status,
        description: commitResponse?.fullDescription || description,
        isPrivate
      })
      setHasBasicInfoDraft(false)
      setHasDescriptionDraft(false)
      setHasTeamDraft(false)
      setHasVacanciesDraft(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), TIMING.toastMs)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Не удалось сохранить проект'
      setSaveError(msg)
      setTimeout(() => setSaveError(null), TIMING.toastMs)
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  const handleStatusSelect = (item: { id: string; label: string }) => {
    setStatus(item.label)
    setStatusOpen(false)
  }

  const inviteMemberMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const nick = email.trim()
      const roleError = checkRoleFormat(role)
      if (nick.length < LIMITS.auth.nicknameMin) {
        throw new Error(minChars(LIMITS.auth.nicknameMin))
      }
      if (roleError) {
        throw new Error(roleError)
      }
      const targetUser = await usersApi.findByNickname(nick)
      if (!targetUser)
        throw new Error('Пользователь с таким ником не найден')      

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
    onSuccess: async () => {
      setInviteEmail('')
      setInviteRole('')
      setInviteRoleError(null)
      setInviteMessage('Участник успешно добавлен в команду')
      setInviteMessageType('success')
      setTimeout(() => resetInviteMessage(), TIMING.toastMs)
      teamInitializedRef.current = false

      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.team(projectId!) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.members(projectId!) })

      await invalidateRelations(queryClient)
    },
    onError: (error: any) => {
      const message = error?.message || error?.toString?.() || 'Не удалось добавить участника'
      setInviteMessage(message)
      setInviteMessageType('error')
      setTimeout(() => resetInviteMessage(), TIMING.toastMs)
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

  const handleDeleteClick = () => { if (projectId) setShowDeleteForm(true) }

  const handleDeleteSuccess = () => {
  queryClient.removeQueries({ queryKey: queryKeys.projects.byId(projectId!) })
    invalidateProjects(queryClient)

    navigate(`${profilePath}/activity`, { replace: true })
  }

  const once = useOnce() 
  const handleResponseAction = (response: ResponseData, action: 'accept' | 'decline') =>
    once(response.responseId, async () => {
      try {
        if (action === 'accept') await responseApi.accept(response.responseId)
        else await responseApi.decline(response.responseId)
        await invalidateRelations(queryClient)
      } catch (error) {
        console.error('Ошибка обработки отклика:', error)
      }
  })

  const handleCancelInvite = async (invite: InviteData) => {
    try {
      await inviteApi.delete(invite.inviteId)
      queryClient.invalidateQueries({ queryKey: queryKeys.invites.outgoing(profileId || '') })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all, refetchType: 'active' })
    }
    catch (error) {
      console.error('Ошибка отмены приглашения:', error)
    }
  }

  return (
    <div className='project-page'>
      {isPreview ? (
        <ProjectPublicView
          isPreview
          data={{
            projectId: projectId!,
            ownerId: project?.ownerId ?? '',
            title: name,
            status,
            description,
            isPrivate,
            ratingCount: projectRating,
          }}
          team={localTeamMembers}
          vacancies={localVacancies}
          onBack={() => { }}
        />
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
                  maxLength={LIMITS.project.titleMax} />
              </div>
              <div className='project-field-row'>
                <label className='project-field-label'>Краткое описание:</label>
                <textarea
                  name="shortDesc"
                  className={`project-short-desc-editor ${projectTouched.shortDesc && projectDirty.shortDesc && checkProjectFormat('shortDesc', shortDesc) ? 'input-error' : ''}`}
                  value={shortDesc}
                  onChange={e => {
                    if (e.target.value.length > LIMITS.project.shortDescriptionMax) return;
                    setShortDesc(e.target.value)
                    handleProjectChange(e)
                  }}
                  onBlur={handleProjectBlur}
                  maxLength={LIMITS.project.shortDescriptionMax}
                  placeholder='Кратко опишите суть проекта в 1-2 предложениях'
                />
              </div>
              <div className='project-field-row'>
                <label className='project-field-label'>Статус:</label>
                <div className='project-select-wrapper' ref={statusMenuRef}>
                  <div className={`project-select ${isStatusOpen ? 'active' : ''}`} onClick={() => setStatusOpen(!isStatusOpen)}>
                    <p className='project-select-value'>{status}</p> <DropdownIcon className={`project-select-arrow ${isStatusOpen ? 'rotated' : ''}`} />
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
              <span className={`description-char-counter ${description.length > LIMITS.longTextMax ? 'limit' : ''}`}>
                {description.length} / {LIMITS.longTextMax}
              </span>
            </div>
            {isPreviewDescription ? (
              <div className='description-preview-container'>
                {description ? (
                  <div className='project-description-preview markdown-content'>
                    <Markdown>{description}</Markdown>
                  </div>
                ) : (
                  <p className='description-preview-empty'>Описание пока не заполнено</p>
                )}
              </div>
            ) : (
              <textarea
                ref={descriptionTextareaRef}
                className={`project-md-editor ${description.length > LIMITS.longTextMax ? 'input-error' : ''}`}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={'### Заголовок проекта\n\nРасскажите о целях и задачах вашего проекта.\n\nИспользуйте **жирный текст** для акцентов и списки для структуры.\n\nПример:\n- Цель проекта\n- Задачи\n- Ожидаемые результаты'}
              />
            )}
            <div className='media-upload-section'>
              <input
                type='file'
                ref={mediaInputRef}
                accept='image/png,image/jpeg,image/webp'
                hidden
                onChange={handleMediaUpload}
                disabled={isUploadingMedia || isPreviewDescription}
              />
              <div className='media-upload-header'>
                <button
                  type='button'
                  className='media-upload-btn'
                  onClick={() => mediaInputRef.current?.click()}
                  disabled={isUploadingMedia || isPreviewDescription}
                >
                  <Add className='media-upload-ico' />
                  <span>Прикрепить медиа</span>
                </button>
                <p className='media-upload-hint'>Общий размер медиа до {LIMITS.upload.mediaTotalMaxBytes / 1024 / 1024} МБ</p>
                <div className='preview-toggle-container'>
                  <p className='preview-toggle-label'>Предпросмотр</p>
                  <Toggle checked={isPreviewDescription} onChange={setIsPreviewDescription} />
                </div>
              </div>
              {mediaError && (
                <p className='media-error-text'>{mediaError}</p>
              )}
              {projectMedia.length > 0 && (
                <div className='media-list'>
                  {projectMedia.map((media, index) => (
                    <div className='media-item-wrapper' key={`${media.name}-${index}`}>
                      <div className='media-item'>
                        <p className='media-name'>{media.name}</p>
                        <p className='media-size'>{formatFileSize(media.size)}</p>
                      </div>
                      <div className='media-actions'>
                        <button
                          type='button'
                          className='media-action-btn copy'
                          onClick={() => handleInsertMedia(media.url)}
                          disabled={isPreviewDescription}
                        >
                          <CopyIcon className='ico' />
                        </button>
                        <button
                          type='button'
                          className='media-action-btn delete'
                          onClick={() => handleDeleteMedia(media.name, media.url, media.isDraft)}
                          disabled={isPreviewDescription}
                        >
                          <RejectIcon className='ico' />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                placeholder='Ник участника'
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
              <input
                className={`project-field-input ${inviteRoleError ? 'input-error' : ''}`}
                placeholder='Роль участника'
                value={inviteRole}
                onChange={handleInviteRoleChange}
                onBlur={handleInviteRoleBlur}
                maxLength={LIMITS.member.roleMax}
              />
              <button
                className='team-invite-btn'
                onClick={handleInvite}
                disabled={
                  inviteEmail.trim().length < LIMITS.auth.nicknameMin ||
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
                  maxLength={LIMITS.vacancy.titleMax} />
                <textarea
                  name="vacDesc"
                  className={`project-md-editor small ${vacancyTouched.vacDesc && checkVacancyFormat('vacDesc', vacDesc) ? 'input-error' : ''}`}
                  placeholder='Описание заявки'
                  value={vacDesc}
                  onChange={e => {
                    const value = e.target.value;
                    if (value.length > LIMITS.vacancy.descriptionMax) return;
                    if (getVisualLineCount(value, e.target) >  LIMITS.vacancy.descriptionMaxLines) return;
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
                    if (getVisualLineCount(value, e.target) > LIMITS.vacancy.tagsMaxLines) return;
                    setVacTags(value);
                  }}
                  onBlur={() => setVacancyTouched(prev => ({ ...prev, vacTags: true }))} />
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

          <CommentsSection 
            referenceType="project" 
            referenceId={projectId!} 
            isOwner={isOwner} 
          />
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