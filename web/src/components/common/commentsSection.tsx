import './comment.scss'
import Edit from '@icons/edit.svg?react'
import Reject from '@icons/reject.svg?react'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { commentApi, type CommentData } from '../services/comment'
import { useAuth } from '../hooks/useAuth'

interface CommentNode extends CommentData {
  replies: CommentNode[]
}

const buildCommentTree = (list: CommentData[]): CommentNode[] => {
  const map = new Map<string, CommentNode>()
  const roots: CommentNode[] = []
  list.forEach(c => map.set(c.commentId, { ...c, replies: [] }))
  list.forEach(c => {
    const node = map.get(c.commentId)!
    if (c.parentCommentId && map.has(c.parentCommentId)) map.get(c.parentCommentId)!.replies.push(node)
    else roots.push(node)
  })
  return roots
}

const repliesLabel = (n: number) => `${n} ${n === 1 ? 'ответ' : n < 5 ? 'ответа' : 'ответов'}`

interface CommentsSectionProps {
  referenceType: string
  referenceId: string
  isOwner?: boolean
  readOnly?: boolean
  canDeleteComment?: (comment: CommentData) => boolean
}

export const CommentsSection = ({
  referenceType,
  referenceId,
  isOwner = false,
  readOnly = false,
  canDeleteComment,
}: CommentsSectionProps) => {
  const { userId, isAuthenticated } = useAuth()

  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: comments = [], refetch } = useQuery({
    queryKey: ['comments', referenceType, referenceId],
    queryFn: () => commentApi.getComments(referenceType, referenceId),
    enabled: !!referenceId,
  })

  const createMutation = useMutation({
    mutationFn: (dto: { content: string; parentCommentId?: string }) =>
      commentApi.create({ referenceType, referenceId, ...dto }),
    onSuccess: () => {
      refetch()
      setNewComment('')
      setReplyingTo(null)
      setReplyContent('')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) => commentApi.update(commentId, content),
    onSuccess: () => {
      refetch()
      setEditingId(null)
      setEditContent('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => commentApi.delete(commentId),
    onSuccess: () => { refetch() },
  })

  const toggleReplies = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const renderNode = (node: CommentNode, depth = 0) => {
    const isAuthor = node.userId === userId
    const canDelete = isAuthor || (canDeleteComment ? canDeleteComment(node) : isOwner)
    const hasReplies = node.replies.length > 0
    const isExpanded = expanded.has(node.commentId)

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

              {!readOnly && !node.isDeleted && (
                <div className='comment-actions-right'>
                  {isAuthor && (
                    <button
                      className='comment-edit-badge'
                      onClick={() => {
                        setReplyingTo(null)
                        setReplyContent('')
                        setEditingId(node.commentId)
                        setEditContent(node.content || '')
                      }}
                    >
                      <Edit className='ico' />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      className='comment-remove-badge'
                      onClick={() => deleteMutation.mutate(node.commentId)}
                      disabled={deleteMutation.isPending}
                    >
                      <Reject className='ico' />
                    </button>
                  )}
                </div>
              )}
            </div>

            {node.isDeleted ? (
              <div className='comment-content deleted'>
                {node.deletedByModerator ? 'Комментарий удален модератором' : 'Комментарий удален'}
              </div>
            ) : (
              <div className='comment-content'>{node.content}</div>
            )}

            <div className='comment-actions-left'>
              {!readOnly && !node.isDeleted && isAuthenticated && (
                <button
                  className='comment-action-text'
                  onClick={() => {
                    setEditingId(null)
                    setEditContent('')
                    setReplyingTo(replyingTo === node.commentId ? null : node.commentId)
                  }}
                >
                  Ответить
                </button>
              )}
              {hasReplies && (
                <button className='comment-action-text expand-replies' onClick={() => toggleReplies(node.commentId)}>
                  {isExpanded ? 'Скрыть ответы' : repliesLabel(node.replies.length)}
                  <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▾</span>
                </button>
              )}
            </div>

            {replyingTo === node.commentId && (
              <div className='comment-reply-input'>
                <textarea
                  className='comment-textarea small'
                  placeholder={`Ответ для @${node.nickname}...`}
                  value={replyContent}
                  onChange={e => setReplyContent(e.target.value)}
                />
                <div className='comment-form-actions'>
                  <button
                    className='comment-btn confirm'
                    onClick={() => createMutation.mutate({ content: replyContent, parentCommentId: node.commentId })}
                    disabled={!replyContent.trim() || createMutation.isPending}
                  >
                    Ответить
                  </button>
                  <button className='comment-btn cancel' onClick={() => { setReplyingTo(null); setReplyContent('') }}>
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {editingId === node.commentId && (
              <div className='comment-edit-input'>
                <textarea
                  className='comment-textarea small'
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                />
                <div className='comment-form-actions'>
                  <button
                    className='comment-btn confirm'
                    onClick={() => updateMutation.mutate({ commentId: node.commentId, content: editContent })}
                    disabled={!editContent.trim() || updateMutation.isPending}
                  >
                    Изменить
                  </button>
                  <button className='comment-btn cancel' onClick={() => { setEditingId(null); setEditContent('') }}>
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {hasReplies && isExpanded && (
          <div className='comment-replies'>
            {node.replies.map(reply => renderNode(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <section className='project-section'>
      <h2 className='project-section-title'>
        Комментарии: <span className='project-count'>{comments.length}</span>
      </h2>

      <div className='comment-input-wrapper'>
        <textarea
          className='comment-textarea'
          placeholder={readOnly ? 'Предпросмотр: отправка комментариев недоступна' : 'Место для твоего комментария...'}
          value={newComment}
          disabled={readOnly}
          onChange={e => setNewComment(e.target.value)}
        />
        <button
          className='comment-btn send'
          onClick={() => createMutation.mutate({ content: newComment })}
          disabled={readOnly || !newComment.trim() || createMutation.isPending || !isAuthenticated}
        >
          Отправить
        </button>
      </div>

      <div className='comments-list'>
        {comments.length === 0 ? (
          <p className='no-comments-text'>
            {readOnly ? 'Пока нет комментариев.' : 'Пока нет комментариев. Будьте первым!'}
          </p>
        ) : (
          buildCommentTree(comments).map(node => renderNode(node))
        )}
      </div>
    </section>
  )
}