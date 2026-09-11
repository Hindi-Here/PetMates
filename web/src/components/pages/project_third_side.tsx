import './project_third_side.scss'
import '../common/comment.scss'

import StarIcon from '@icons/star.svg?react'
import StatusEndIcon from '@icons/status_end.svg?react'
import StatusPauseIcon from '@icons/status_pause.svg?react'
import StatusWorkingIcon from '@icons/status_working.svg?react'
import Edit from '@icons/edit.svg?react'
import RejectIcon from '@icons/reject.svg?react'
import LockIcon from '@icons/lock.svg?react'
import BackIcon from '@icons/back.svg?react'

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import type { UserData } from '../services/users'
import { projectsApi } from '../services/project'
import { projectMembersApi } from '../services/project_members'
import { usersApi } from '../services/users'
import { vacanciesApi } from '../services/vacancy'
import { commentApi, type CommentData } from '../services/comment'
import { useAuth } from '../hooks/useAuth'
import { useSystemRole } from '../hooks/useSystemRole'
import InviteUserForm from '../forms/invite_user'
import { canModerateTarget } from '../scripts/moderation'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'

import { VacancyCard } from '../common/vacancyCard'
import { UserCard } from '../common/userCard'
import DeleteProjectModerationForm from '../forms/delete_project_moderation'

export interface TeamMemberWithUser {
  memberId: string
  projectId: string
  userId: string
  role: string
  joinedAt?: string
  userData?: UserData
  isOwner?: boolean
}

interface CommentNode extends CommentData {
  replies: CommentNode[]
}

const getStatusConfig = (status: string) => {
  const configs: Record<string, {
    text: string
    className: string
    Icon: React.ComponentType<{ className?: string }>
  }> = {
    'В процессе': { text: 'В процессе', className: 'status-working', Icon: StatusWorkingIcon },
    'Завершён': { text: 'Завершён', className: 'status-end', Icon: StatusEndIcon },
    'Приостановлен': { text: 'Приостановлен', className: 'status-pause', Icon: StatusPauseIcon }
  }
  return configs[status] || configs['В процессе']
}

const buildCommentTree = (commentsList: CommentData[]): CommentNode[] => {
  const map = new Map<string, CommentNode>()
  const roots: CommentNode[] = []
  commentsList.forEach(c => map.set(c.commentId, { ...c, replies: [] }))
  commentsList.forEach(c => {
    const node = map.get(c.commentId)!
    if (c.parentCommentId && map.has(c.parentCommentId)) {
      map.get(c.parentCommentId)!.replies.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

export default function ProjectThirdSide() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const { userId: currentUserId } = useAuth()
  const currentSystemRole = useSystemRole()
  const queryClient = useQueryClient()

  const [hasRated, setHasRated] = useState(false)
  const [isRatingLoading, setIsRatingLoading] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState<UserData | null>(null)
  const [showDeleteProjectForm, setShowDeleteProjectForm] = useState(false)

  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: queryKeys.projects.byId(projectId!),
    queryFn: () => projectsApi.getProject(projectId!),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  })

  const { data: ownerData, isLoading: ownerLoading } = useQuery({
    queryKey: ['users', 'byId', project?.ownerId],
    queryFn: () => usersApi.getUserById(project!.ownerId),
    enabled: !!project?.ownerId,
  })

  const { data: teamMembers = [] } = useQuery<TeamMemberWithUser[]>({
    queryKey: queryKeys.projects.memberProjects(projectId!),
    queryFn: async () => {
      if (!projectId) return []
      const members = await projectMembersApi.getByProject(projectId)
      const proj = await projectsApi.getProject(projectId)

      const membersWithUsers: TeamMemberWithUser[] = members.map((member: any) => ({
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  })

  const { data: vacancies = [] } = useQuery({
    queryKey: queryKeys.vacancies.byProject(projectId!),
    queryFn: () => vacanciesApi.getByProject(projectId!),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  })

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ['comments', 'project', projectId],
    queryFn: () => commentApi.getComments('project', projectId!),
    enabled: !!projectId,
  })

  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate(-1)
      }
    }
    window.addEventListener('keydown', handleEscKey)
    return () => {
      window.removeEventListener('keydown', handleEscKey)
    }
  }, [navigate])

  useEffect(() => {
    if (!projectId || !currentUserId || currentUserId === project?.ownerId) return

    const fetchRatingStatus = async () => {
      try {
        const ratingStatus = await projectsApi.getUserRating(projectId)
        setHasRated(ratingStatus.hasRated)
      } catch (error) {
        console.error('Failed to load rating status:', error)
      }
    }
    fetchRatingStatus()
  }, [projectId, currentUserId, project?.ownerId])

  const createCommentMutation = useMutation({
    mutationFn: (dto: any) => commentApi.create(dto),
    onSuccess: () => {
      refetchComments()
      setNewComment('')
      setReplyingTo(null)
      setReplyContent('')
    },
  })

  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string, content: string }) => commentApi.update(commentId, content),
    onSuccess: () => {
      refetchComments()
      setEditingCommentId(null)
      setEditContent('')
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => commentApi.delete(commentId),
    onSuccess: () => {
      refetchComments()
    },
  })

  const toggleReplies = (commentId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(commentId)) newSet.delete(commentId)
      else newSet.add(commentId)
      return newSet
    })
  }

  const isExpanded = (commentId: string) => expandedComments.has(commentId)

  const renderCommentNode = (node: CommentNode, depth = 0) => {
    const isAuthor = node.userId === currentUserId
    const canEdit = isAuthor
    const canDelete = isAuthor || canModerateTarget(currentSystemRole, (node as any).authorSystemRole)
    const hasReplies = node.replies.length > 0
    const expanded = isExpanded(node.commentId)

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
                <span className='comment-date'>
                  {new Date(node.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}, {' '}
                  {new Date(node.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {node.isEdited && <span className='comment-edited'>• изменено</span>}
              </div>

              {!node.isDeleted && (
                <div className='comment-actions-right'>
                  {canEdit && (
                    <button className='comment-edit-badge' onClick={() => {
                      setReplyingTo(null); setReplyContent(''); setEditingCommentId(node.commentId); setEditContent(node.content || '')
                    }}>
                      <Edit className='ico' />
                    </button>
                  )}
                  {canDelete && (
                    <button className='comment-remove-badge' onClick={() => {deleteCommentMutation.mutate(node.commentId)}}>
                      <RejectIcon className='ico' />
                    </button>
                  )}
                </div>
              )}
            </div>

            {node.isDeleted ? (
              <div className='comment-content deleted'>
                {(node as any).deletedByModerator ? 'Комментарий удален модератором' : 'Комментарий удален'}
              </div>
            ) : (
              <div className='comment-content'>{node.content}</div>
            )}

            <div className='comment-actions-left'>
              {!node.isDeleted && (
                <button className='comment-action-text' onClick={() => {
                  setEditingCommentId(null); setEditContent(''); setReplyingTo(replyingTo === node.commentId ? null : node.commentId)
                }}>
                  Ответить
                </button>
              )}
              {hasReplies && (
                <button className='comment-action-text expand-replies' onClick={() => toggleReplies(node.commentId)}>
                  {expanded ? 'Скрыть ответы' : `${node.replies.length} ${node.replies.length === 1 ? 'ответ' : node.replies.length < 5 ? 'ответа' : 'ответов'}`}
                  <span className={`expand-icon ${expanded ? 'expanded' : ''}`}>▾</span>
                </button>
              )}
            </div>

            {replyingTo === node.commentId && (
              <div className='comment-reply-input'>
                <textarea className='comment-textarea small' placeholder={`Ответ для @${node.nickname}...`} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} />
                <div className='comment-form-actions'>
                  <button className='comment-btn confirm' onClick={() => createCommentMutation.mutate({ referenceType: 'project', referenceId: projectId!, content: replyContent, parentCommentId: node.commentId })} disabled={!replyContent.trim() || createCommentMutation.isPending}>Ответить</button>
                  <button className='comment-btn cancel' onClick={() => { setReplyingTo(null); setReplyContent('') }}>Отмена</button>
                </div>
              </div>
            )}

            {editingCommentId === node.commentId && (
              <div className='comment-edit-input'>
                <textarea className='comment-textarea small' value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                <div className='comment-form-actions'>
                  <button className='comment-btn confirm' onClick={() => updateCommentMutation.mutate({ commentId: node.commentId, content: editContent })} disabled={!editContent.trim() || updateCommentMutation.isPending}>Изменить</button>
                  <button className='comment-btn cancel' onClick={() => { setEditingCommentId(null); setEditContent('') }}>Отмена</button>
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
    )
  }

  const isStaff = currentSystemRole === 'admin' || currentSystemRole === 'moderator'
  const isMyProject = currentUserId ? project?.ownerId === currentUserId : false
  const isBanned = (ownerData as any)?.isBanned === true

  if (!isMyProject && !isStaff) {
    if (projectLoading || ownerLoading) {
      return <div className="loading-container"/>
    }
    
    if (!project || !ownerData || isBanned) {
      return (
        <div className='banned-gate'>
          <div className='info-container'>
            <LockIcon className='info-ico' />
            <p className='info-comment'>Проект недоступен</p>
            <p className='info-subcomment'>Владелец проекта заблокирован</p>
          </div>
        </div>
      )
    }
  }

  const ownerSystemRole = (ownerData as any)?.systemRole
  const canModerateDelete = !!project && !project.isPrivate && canModerateTarget(currentSystemRole, ownerSystemRole)

  const handleModerationDeleteProject = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteProjectForm(true)
  }

  const handleRateClick = async () => {
    if (!currentUserId || isRatingLoading) return
    setIsRatingLoading(true)
    try {
      const result = await projectsApi.toggleRating(projectId!, hasRated)
      setHasRated(result.hasRated)

      queryClient.setQueryData(queryKeys.projects.byId(projectId!), (old: any) => {
        if (!old) return old
        return { ...old, ratingCount: result.ratingCount }
      })
    } catch (error) {
      console.error('Failed to toggle rating:', error)
    } finally {
      setIsRatingLoading(false)
    }
  }

  const handleBack = () => {
  if (project?.ownerId) {
    navigate(`/profile/${project.ownerId}/activity`, { replace: true })
  }
}

  return (
    <div className='project-page'>
      <div className='project-preview-header'>
        <div className='project-info'>
          <h2 className='project-title'>О проекте {project?.title || ''}</h2>
          {project && (() => {
            const statusConfig = getStatusConfig(project.status)
            const StatusIcon = statusConfig.Icon
            return (
              <div className={`project-status ${statusConfig.className}`}>
                {StatusIcon && <StatusIcon className='status-ico' />}
                <span>{statusConfig.text}</span>
              </div>
            )
          })()}
        </div>
        <div className='project-actions'>
          <div className='rate-column'>
            <button className={`rate-button ${hasRated ? 'rated' : ''}`} onClick={handleRateClick} disabled={isRatingLoading || !currentUserId}>
              {hasRated ? 'Оценено' : 'Оценить'}
            </button>
            <div className='project-rating'>
              <StarIcon className='star-ico small' />
              <span>{project?.ratingCount || 0} оценок</span>
            </div>
          </div>
          <button className='back-button' onClick={handleBack}>
            <BackIcon className='ico' />
          </button>
          {canModerateDelete && (
            <button
              className='moderation-delete-project-btn'
              onClick={handleModerationDeleteProject}
            >
              <RejectIcon className='ico' />
            </button>
          )}
        </div>
      </div>

      {project?.fullDescription && (
        <section className='preview-section'>
          <div className='project-description-preview markdown-content'>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {project.fullDescription}
            </ReactMarkdown>
          </div>
        </section>
      )}
      {!project?.fullDescription && (
        <div className='empty-state'><p className='empty-text'>Проект пока не заполнен</p></div>
      )}

      {(teamMembers as any[]).length > 0 && (
        <section className='preview-section'>
          <h3 className='preview-section-title'>Команда: <span className='count'>{(teamMembers as any[]).length}</span></h3>
          <div className='team-list-preview'>
            {(teamMembers as any[])
              .filter((member: any): member is typeof member & { userData: UserData } => 'userData' in member && !!member.userData)
              .map((member: any) => (
                <UserCard 
                  key={member.memberId} 
                  user={member.userData} 
                  isOwner={member.isOwner} 
                  role={member.role} 
                  disabledInvite={true}
                  showModerationDelete={canModerateDelete}
                />
              ))}
          </div>
        </section>
      )}

      {(vacancies as any[]).length > 0 && (
        <section className='preview-section'>
          <h3 className='preview-section-title'>Заявки: <span className='count'>{(vacancies as any[]).length}</span></h3>
          <div className='vacancy-list-preview'>
            {(vacancies as any[]).map((vacancy: any) => (
              <VacancyCard 
                key={vacancy.vacancyId} 
                vacancy={vacancy} 
                showModerationDelete={canModerateDelete}
                clickable={false}
              />
            ))}
          </div>
        </section>
      )}

      <section className='preview-section'>
        <h3 className='preview-section-title'>
          Комментарии: <span className='count'>{(comments as any[]).length}</span>
        </h3>

        <div className='comment-input-wrapper'>
          <textarea
            className='comment-textarea'
            placeholder='Место для твоего комментария...'
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
          {(comments as any[]).length === 0 ? (
            <p className='no-comments-text'>Пока нет комментариев. Будьте первым!</p>
          ) : (
            buildCommentTree(comments as any[]).map(node => renderCommentNode(node))
          )}
        </div>
      </section>

      {showInviteForm && (
        <InviteUserForm onClose={() => setShowInviteForm(null)} invitedUser={showInviteForm} />
      )}

      {showDeleteProjectForm && project && (
        <DeleteProjectModerationForm
          projectId={projectId!}
          projectTitle={project.title}
          onClose={() => setShowDeleteProjectForm(false)}
          onSuccess={() => {
            navigate(-1)
          }}
        />
      )}
    </div>
  )
}