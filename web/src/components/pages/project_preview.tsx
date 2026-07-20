import './project_third_side.scss'
import '../common/comment.scss'

import StarIcon from '@icons/star.svg?react'
import StatusEndIcon from '@icons/status_end.svg?react'
import StatusPauseIcon from '@icons/status_pause.svg?react'
import StatusWorkingIcon from '@icons/status_working.svg?react'
import Edit from '@icons/edit.svg?react'
import Delete from '@icons/delete.svg?react'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { UserData } from '../services/users'
import type { VacancyData } from '../services/vacancy'
import type { CommentData } from '../services/comment'

import { VacancyCard } from '../common/vacancyCard'
import { UserCard } from '../common/userCard'

export interface TeamMemberWithUser {
  memberId: string; projectId: string; userId: string; role: string;
  joinedAt?: string; userData?: UserData; isOwner?: boolean
}

export interface TeamMember { id: number; email: string; role: string; isOwner?: boolean }

interface CommentNode extends CommentData {
  replies: CommentNode[];
}

interface ProjectPreviewProps {
  name: string; shortDesc: string; status: string; description: string;
  team: Array<TeamMember | TeamMemberWithUser>; vacancies: VacancyData[]; 
  isOwner?: boolean; ratingCount?: number; isPrivate?: boolean;
  comments?: CommentData[]
}

export const ProjectPreview = ({ 
  name, status, description, team, vacancies, 
  isOwner = true, ratingCount = 0, comments = []
}: ProjectPreviewProps) => {
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { text: string; className: string; Icon: React.ComponentType<{ className?: string }> }> = {
      'В процессе': { text: 'В процессе', className: 'status-working', Icon: StatusWorkingIcon },
      'Завершён': { text: 'Завершён', className: 'status-end', Icon: StatusEndIcon },
      'Приостановлен': { text: 'Приостановлен', className: 'status-pause', Icon: StatusPauseIcon }
    }
    return configs[status] || configs['В процессе']
  }
  const statusConfig = getStatusConfig(status); const StatusIcon = statusConfig.Icon

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

  const renderReadOnlyCommentNode = (node: CommentNode, depth = 0) => {
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
                  <button className='comment-edit-badge' disabled title="Недоступно в предпросмотре">
                    <Edit className='ico' />
                  </button>
                  <button className='comment-remove-badge' disabled title="Недоступно в предпросмотре">
                    <Delete className='ico' />
                  </button>
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
                <button className='comment-action-text' disabled title="Недоступно в предпросмотре">
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
          </div>
        </div>

        {hasReplies && expanded && (
          <div className='comment-replies'>
            {node.replies.map(reply => renderReadOnlyCommentNode(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className='project-preview-header'>
        <div className='project-info'>
          <h2 className='project-title'>О проекте {name}</h2>
          <div className={`project-status ${statusConfig.className}`}>
            <StatusIcon className='status-ico' />
            <span>{statusConfig.text}</span>
          </div>
        </div>
        <div className='project-actions'>
          <button className='rate-button' disabled={isOwner} style={isOwner ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
            Оценить
          </button>
          <div className='project-rating'>
            <StarIcon className='star-ico small' />
            <span>{ratingCount || 0} оценок</span>
          </div>
        </div>
      </div>

      {description && (
        <section className='preview-section'>
          <div className='project-description-preview markdown-content'>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
          </div>
        </section>
      )}
      {!description && (
        <div className='empty-state'><p className='empty-text'>Проект пока не заполнен</p></div>
      )}

      {team.length > 0 && (
        <section className='preview-section'>
          <h3 className='preview-section-title'>Команда: <span className='count'>{team.length}</span></h3>
          <div className='team-list-preview'>
            {team.map(member => {
              const key = 'memberId' in member ? member.memberId : String(member.id)
              const userData = 'userData' in member ? member.userData : undefined
              const isOwnerMember = member.isOwner || false
              const role = member.role || ''

              if (!userData) {
                return (
                  <div key={key} className='user-card-container loading'>
                    <div className='info-place-container'>
                      <div className='avatar-container'><div className='member-avatar-placeholder' /></div>
                      <div className='info-container'>
                        <div className='nickname-row'><p className='nickname-text'>Загрузка...</p></div>
                        <p className='role-text'>{role}</p>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <UserCard
                  key={key}
                  user={userData}
                  isOwner={isOwnerMember}
                  role={role}
                  disabledInvite={true}
                />
              )
            })}
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

      <section className='preview-section'>
        <h3 className='preview-section-title'>
          Комментарии: <span className='count'>{comments.length}</span>
        </h3>

        <div className='comment-input-wrapper'>
          <textarea className='comment-textarea' placeholder='Предпросмотр: отправка комментариев недоступна' disabled />
          <button className='comment-btn send' disabled>Отправить</button>
        </div>

        <div className='comments-list'>
          {comments.length === 0 ? (
            <p className='no-comments-text'>Пока нет комментариев.</p>
          ) : (
            buildCommentTree(comments).map(node => renderReadOnlyCommentNode(node))
          )}
        </div>
      </section>
    </>
  )
}
