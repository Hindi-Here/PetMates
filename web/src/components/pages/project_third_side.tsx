import './project_third_side.scss'
import '../common/comment.scss'

import StarIcon from '@icons/star.svg?react'
import StatusEndIcon from '@icons/status_end.svg?react'
import StatusPauseIcon from '@icons/status_pause.svg?react'
import StatusWorkingIcon from '@icons/status_working.svg?react'
import Edit from '@icons/edit.svg?react'
import Delete from '@icons/delete.svg?react'

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { UserData } from '../services/users'
import { projectsApi } from '../services/project'
import { projectMembersApi } from '../services/project_members'
import { usersApi } from '../services/users'
import { vacanciesApi } from '../services/vacancy'
import { commentApi, type CommentData } from '../services/comment'
import { useAuth } from '../hooks/useAuth'
import InviteUserForm from '../forms/invite_user'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'

import { VacancyCard } from '../common/vacancyCard'
import { UserCard } from '../common/userCard'

export interface TeamMemberWithUser {
  memberId: string; projectId: string; userId: string; role: string;
  joinedAt?: string; userData?: UserData; isOwner?: boolean
}

interface CommentNode extends CommentData {
  replies: CommentNode[];
}

export default function ProjectThirdSide() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  
  const [hasRated, setHasRated] = useState(false)
  const [isRatingLoading, setIsRatingLoading] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState<UserData | null>(null)

  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())

  const { data: project } = useQuery({
    queryKey: queryKeys.projects.byId(projectId!),
    queryFn: () => projectsApi.getProject(projectId!),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  })

  const { data: teamMembers = []} = useQuery({
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
          } catch {
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  })

  const { data: vacancies = []} = useQuery({
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
        handleBack()
      }
    }

    window.addEventListener('keydown', handleEscKey)
    
    return () => {
      window.removeEventListener('keydown', handleEscKey)
    }
  }, [])

  useEffect(() => {
    if (!projectId || !userId || userId === project?.ownerId) return
    
    const fetchRatingStatus = async () => {
      try {
        const ratingStatus = await projectsApi.getUserRating(projectId)
        setHasRated(ratingStatus.hasRated)
      } catch (error) {
        console.error('Failed to load rating status:', error)
      }
    }
    fetchRatingStatus()
  }, [projectId, userId, project?.ownerId])

  const handleRateClick = async () => {
    if (!userId || isRatingLoading) return
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

  const handleBack = () => navigate(-1)

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { text: string; className: string; Icon: React.ComponentType<{ className?: string }> }> = {
      'В процессе': { text: 'В процессе', className: 'status-working', Icon: StatusWorkingIcon },
      'Завершён': { text: 'Завершён', className: 'status-end', Icon: StatusEndIcon },
      'Приостановлен': { text: 'Приостановлен', className: 'status-pause', Icon: StatusPauseIcon }
    }
    return configs[status] || configs['В процессе']
  }

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

  const renderCommentNode = (node: CommentNode, depth = 0) => {
    const isAuthor = node.userId === userId

    const canDelete = isAuthor
    const canEdit = isAuthor
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
                    <button className='comment-remove-badge' onClick={() => {
                      if (window.confirm('Удалить этот комментарий?')) deleteCommentMutation.mutate(node.commentId)
                    }}>
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
          <button className={`rate-button ${hasRated ? 'rated' : ''}`} onClick={handleRateClick} disabled={isRatingLoading || !userId}>
            {hasRated ? 'Оценено' : 'Оценить'}  
          </button>
          <div className='project-rating'>
            <StarIcon className='star-ico small' />
            <span>{project?.ratingCount || 0} оценок</span>
          </div>
        </div>
      </div>

      {project?.fullDescription && (
        <section className='preview-section'>
          <div className='project-description-preview markdown-content'>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{project.fullDescription}</ReactMarkdown>
          </div>
        </section>
      )}
      {!project?.fullDescription && (
        <div className='empty-state'><p className='empty-text'>Проект пока не заполнен</p></div>
      )}

      {teamMembers.length > 0 && (
        <section className='preview-section'>
          <h3 className='preview-section-title'>Команда: <span className='count'>{teamMembers.length}</span></h3>
          <div className='team-list-preview'>
            {teamMembers
              .filter((member): member is typeof member & { userData: UserData } => 'userData' in member && !!member.userData)
              .map(member => (
                <UserCard key={member.memberId} user={member.userData} isOwner={member.isOwner} role={member.role} disabledInvite={true} />
              ))}
          </div>
        </section>
      )}

      {vacancies.length > 0 && (
        <section className='preview-section'>
          <h3 className='preview-section-title'>Заявки: <span className='count'>{vacancies.length}</span></h3>
          <div className='vacancy-list-preview'>
            {vacancies.map(vacancy => (
              <VacancyCard key={vacancy.vacancyId} vacancy={vacancy} />
            ))}
          </div>
        </section>
      )}

      {/* --- РАЗДЕЛ КОММЕНТАРИЕВ --- */}
      <section className='preview-section'>
        <h3 className='preview-section-title'>
          Комментарии: <span className='count'>{comments.length}</span>
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
          {comments.length === 0 ? (
            <p className='no-comments-text'>Пока нет комментариев. Будьте первым!</p>
          ) : (
            buildCommentTree(comments).map(node => renderCommentNode(node))
          )}
        </div>
      </section>

      {showInviteForm && (
        <InviteUserForm onClose={() => setShowInviteForm(null)} invitedUser={showInviteForm} />
      )}
    </div>
  )
}