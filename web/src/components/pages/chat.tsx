import './chat.scss'
import Edit from '@icons/edit.svg?react'
import ReplyIcon from '@icons/reply.svg?react'
import ForwardIcon from '@icons/forward.svg?react'
import MoreIcon from '@icons/more.svg?react'
import SearchIcon from '@icons/search.svg?react'
import Reject from '@icons/reject.svg?react'
import BackIcon from '@icons/back.svg?react'
import CopyIcon from '@icons/copy.svg?react'
import AcceptIcon from '@icons/accept.svg?react'
import CheckIcon from '@icons/accept.svg?react'
import WaitIcon from '@icons/chat-state-wait.svg?react'
import SentIcon from '@icons/chat-state-send.svg?react'
import ReadIcon from '@icons/chat-state-read.svg?react'

import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { conversationApi, type MessageData } from '../services/conversation'
import { usersApi } from '../services/users'
import { useAuth } from '../hooks/useAuth'

type MessageStatus = 'wait' | 'sent' | 'read'

const getMessageStatus = (msg: MessageData, otherLastReadAt: string | null): MessageStatus => {
  if (msg.messageId.startsWith('temp-')) return 'wait'
  if (otherLastReadAt && new Date(msg.createdAt) <= new Date(otherLastReadAt)) return 'read'
  return 'sent'
}

const formatDateLabel = (dateStr: string) => {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (isSameDay(date, today)) return 'Сегодня'
  if (isSameDay(date, yesterday)) return 'Вчера'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export const Chat = () => {
  const navigate = useNavigate()
  const { profileId, conversationId } = useParams<{ profileId: string; conversationId: string }>()
  const { userId: currentUserId } = useAuth()
  const queryClient = useQueryClient()

  const [newMessage, setNewMessage] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<MessageData | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [forwardTarget, setForwardTarget] = useState<MessageData | string[] | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  const [unreadDividerTimestamp, setUnreadDividerTimestamp] = useState<string | null>(null)
  const [unreadDismissed, setUnreadDismissed] = useState(false)
  const hasCapturedUnreadRef = useRef(false)

  const messageBubbleRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const messageWrapperRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const messagesListRef = useRef<HTMLDivElement>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: conversations = [] } = useQuery({
    queryKey: queryKeys.conversations.all,
    queryFn: () => conversationApi.getConversations(),
    staleTime: 0,
  })

  const currentConversation = conversations.find(c => c.conversationId === conversationId)

  const { data: otherUser } = useQuery({
    queryKey: ['users', 'byId', currentConversation?.otherUserId],
    queryFn: () => usersApi.getUserById(currentConversation!.otherUserId),
    enabled: !!currentConversation?.otherUserId,
  })

  const { data: messagesResponse } = useQuery({
    queryKey: queryKeys.conversations.messages(conversationId!),
    queryFn: () => conversationApi.getMessages(conversationId!),
    enabled: !!conversationId,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const messages = messagesResponse?.messages || []
  const otherLastReadAt = messagesResponse?.otherLastReadAt ?? null

  useEffect(() => {
    if (messagesResponse && !hasCapturedUnreadRef.current) {
      setUnreadDividerTimestamp((messagesResponse as any)?.previousLastReadAt ?? null)
      hasCapturedUnreadRef.current = true
    }
  }, [messagesResponse])

  useEffect(() => {
    hasCapturedUnreadRef.current = false
    setUnreadDividerTimestamp(null)
    setUnreadDismissed(false)
    setOpenMenuId(null)
  }, [conversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages.length])

  const handleBack = () => navigate(`/profile/${profileId}/messages`)

  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSearch) { setShowSearch(false); return }
        if (selectionMode) { setSelectionMode(false); setSelectedIds(new Set()); return }
        if (replyingTo) { setReplyingTo(null); return }
        if (editingMessageId) { setEditingMessageId(null); setNewMessage(''); return }
        handleBack()
      }
    }
    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [showSearch, selectionMode, replyingTo, editingMessageId])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = 20
    const maxHeight = lineHeight * 12
    const newHeight = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${newHeight}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [newMessage])

  useEffect(() => {
    const el = messagesListRef.current
    if (!el) return
    const handleScroll = () => setOpenMenuId(null)
    el.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleScroll)
    return () => {
      el.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  useEffect(() => {
    if (selectionMode) setOpenMenuId(null)
  }, [selectionMode])

  useEffect(() => {
    if (!openMenuId) return
    const handleClickOutside = (e: MouseEvent) => {
      const wrapperEl = messageWrapperRefs.current.get(openMenuId)
      if (wrapperEl && !wrapperEl.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  const scrollToMessage = (messageId: string) => {
    const el = messageBubbleRefs.current.get(messageId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('chat-message-highlight')
    setTimeout(() => el.classList.remove('chat-message-highlight'), 1200)
  }

  const sendMutation = useMutation({
    mutationFn: (content: string) => conversationApi.sendMessage(conversationId!, content, replyingTo?.messageId),
    onMutate: async (content: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.conversations.messages(conversationId!) })
      const previous = queryClient.getQueryData<any>(queryKeys.conversations.messages(conversationId!))

      const optimisticMessage: MessageData = {
        messageId: `temp-${Date.now()}`,
        senderId: currentUserId!,
        nickname: null,
        avatarUrl: null,
        content,
        isEdited: false,
        isDeleted: false,
        parentMessageId: replyingTo?.messageId ?? null,
        parentContent: replyingTo?.content ?? null,
        parentNickname: replyingTo?.nickname ?? null,
        isForwarded: false,
        forwardedFromNickname: null,
        createdAt: new Date().toISOString(),
      }

      queryClient.setQueryData(queryKeys.conversations.messages(conversationId!), (old: any) => ({
        ...old,
        messages: [...(old?.messages || []), optimisticMessage],
      }))

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.conversations.messages(conversationId!), context.previous)
      }
    },
    onSuccess: () => {
      setNewMessage('')
      setReplyingTo(null)
      setUnreadDismissed(true)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(conversationId!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      conversationApi.updateMessage(messageId, content),
    onSuccess: () => {
      setEditingMessageId(null)
      setNewMessage('')
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(conversationId!) })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => conversationApi.deleteMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(conversationId!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all })
    },
  })

  const deleteForMeMutation = useMutation({
    mutationFn: (messageId: string) => conversationApi.deleteMessageForMe(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(conversationId!) })
    },
  })

  const forwardMutation = useMutation({
    mutationFn: ({ sourceMessageId, targetConversationId }: { sourceMessageId: string; targetConversationId: string }) =>
      conversationApi.forwardMessage(sourceMessageId, targetConversationId),
    onSuccess: () => {
      setForwardTarget(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all })
    },
  })

  const handleSubmit = () => {
    if (!newMessage.trim()) return
    if (editingMessageId) {
      updateMutation.mutate({ messageId: editingMessageId, content: newMessage })
    } else {
      sendMutation.mutate(newMessage)
    }
  }

  const startEdit = (msg: MessageData) => {
    setReplyingTo(null)
    setOpenMenuId(null)
    setEditingMessageId(msg.messageId)
    setNewMessage(msg.content || '')
    textareaRef.current?.focus()
  }

  const cancelEdit = () => {
    setEditingMessageId(null)
    setNewMessage('')
  }

  const startReply = (msg: MessageData) => {
    setEditingMessageId(null)
    setOpenMenuId(null)
    setNewMessage('')
    setReplyingTo(msg)
    textareaRef.current?.focus()
  }

  const handleCopy = async (msg: MessageData) => {
    if (!msg.content) return
    try {
      await navigator.clipboard.writeText(msg.content)
      setCopiedMessageId(msg.messageId)
      setTimeout(() => setCopiedMessageId(null), 1500)
    } catch (err) {
      console.error('Не удалось скопировать:', err)
    }
  }

  const toggleSelect = (messageId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }

  const enterSelectionMode = (messageId: string) => {
    setSelectionMode(true)
    setSelectedIds(new Set([messageId]))
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const handleBulkDeleteForMe = async () => {
    if (!window.confirm(`Удалить ${selectedIds.size} сообщений у себя?`)) return
    await Promise.all(Array.from(selectedIds).map(id => deleteForMeMutation.mutateAsync(id)))
    exitSelectionMode()
  }

  const handleBulkDeleteForAll = async () => {
    if (!window.confirm(`Удалить ${selectedIds.size} сообщений у всех?`)) return
    await Promise.all(Array.from(selectedIds).map(id => deleteMutation.mutateAsync(id)))
    exitSelectionMode()
  }

  const handleBulkForward = () => {
    setForwardTarget(Array.from(selectedIds))
  }

  const selectedMessages = messages.filter(m => selectedIds.has(m.messageId))
  const allSelectedAreMine = selectedMessages.length > 0 && selectedMessages.every(m => m.senderId === currentUserId)

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages
    const q = searchQuery.trim().toLowerCase()
    return messages.filter(m => !m.isDeleted && (m.content || '').toLowerCase().includes(q))
  }, [messages, searchQuery])

  const renderList = showSearch && searchQuery.trim() ? filteredMessages : messages
  let lastDateLabel: string | null = null
  let unreadDividerShown = false

  return (
    <div className='chat-page'>
      <div className='chat-header'>
        <button className='chat-back-btn' onClick={handleBack}>
          <BackIcon className='ico' />
        </button>

        <div
          className='chat-header-user'
          onClick={() => currentConversation && navigate(`/profile/${currentConversation.otherUserId}/info`)}
        >
          <img className='chat-header-avatar' src={otherUser?.avatarUrl || '/default-avatar.png'} alt={otherUser?.nickname || 'User'} />
          <div className='chat-header-info'>
            <p className='chat-header-nickname'>{otherUser?.nickname || currentConversation?.otherUserNickname || 'Пользователь'}</p>
            <p className='chat-header-status'>
              {otherUser?.isOnline ? 'В сети' : otherUser?.lastSeen ? `Был(а) ${otherUser.lastSeen}` : ''}
            </p>
          </div>
        </div>

        <button
          className={`chat-search-toggle ${showSearch ? 'active' : ''}`}
          onClick={() => { setShowSearch(!showSearch); setSearchQuery('') }}
        >
          <SearchIcon className='ico' />
        </button>
      </div>

      {showSearch && (
        <div className='chat-search-bar'>
          <SearchIcon className='ico' />
          <input
            autoFocus
            className='chat-search-input'
            placeholder='Поиск по сообщениям'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {selectionMode && (
        <div className='chat-selection-bar'>
          <span>Выбрано: {selectedIds.size}</span>
          <div className='chat-selection-actions'>
            <button className='chat-btn secondary' onClick={handleBulkForward} disabled={selectedIds.size === 0}>
              Переслать
            </button>
            {allSelectedAreMine && (
              <button className='chat-btn danger' onClick={handleBulkDeleteForAll} disabled={selectedIds.size === 0}>
                Удалить у всех
              </button>
            )}
            <button className='chat-btn warning' onClick={handleBulkDeleteForMe} disabled={selectedIds.size === 0}>
              Удалить у себя
            </button>
            <button className='chat-btn cancel' onClick={exitSelectionMode}>
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className='chat-messages-list' ref={messagesListRef}>
        {renderList.length === 0 ? (
          <p className='no-messages-text'>
            {searchQuery.trim() ? 'Ничего не найдено' : 'Пока нет сообщений. Начните переписку!'}
          </p>
        ) : (
          renderList.map(msg => {
            const isMine = msg.senderId === currentUserId
            const dateLabel = formatDateLabel(msg.createdAt)
            const showDateDivider = dateLabel !== lastDateLabel
            if (showDateDivider) lastDateLabel = dateLabel

            const isFirstUnread =
              !unreadDividerShown &&
              !unreadDismissed &&
              unreadDividerTimestamp &&
              !isMine &&
              new Date(msg.createdAt) > new Date(unreadDividerTimestamp)
            if (isFirstUnread) unreadDividerShown = true

            const isSelected = selectedIds.has(msg.messageId)

            return (
              <Fragment key={msg.messageId}>
                {showDateDivider && (
                  <div className='chat-date-divider'>
                    <div className='divider-line' />
                    <span className='divider-text'>{dateLabel}</span>
                    <div className='divider-line' />
                  </div>
                )}
                {isFirstUnread && (
                  <div className='chat-unread-divider'>
                    <div className='divider-line' />
                    <span className='divider-text'>Новые сообщения</span>
                    <div className='divider-line' />
                  </div>
                )}

                <div
                  className={`chat-message-wrapper ${isMine ? 'mine' : 'theirs'} ${isSelected ? 'selected' : ''}`}
                  ref={(el) => {
                    if (el) messageWrapperRefs.current.set(msg.messageId, el)
                    else messageWrapperRefs.current.delete(msg.messageId)
                  }}
                >
                  {selectionMode && (
                    <div
                      className={`chat-select-checkbox ${isMine ? 'left' : 'right'}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelect(msg.messageId)
                      }}
                    >
                      {isSelected && <CheckIcon className='check-icon' />}
                    </div>
                  )}

                  <div
                    className={`chat-message ${isMine ? 'mine' : 'theirs'}`}
                    onClick={() => { if (selectionMode) toggleSelect(msg.messageId) }}
                  >
                    <div className='chat-message-column'
                      onMouseLeave={() => {
                        setTimeout(() => {
                        if (!messagesListRef.current?.contains(document.activeElement)) {
                          setOpenMenuId(null)
                        }
                      }, 100)
                      }}>
                      {!msg.isDeleted && !selectionMode && (
                        <div className={`chat-hover-actions ${isMine ? 'mine' : 'theirs'}`}>
                          <button className='chat-hover-btn' onClick={() => startReply(msg)}>
                            <ReplyIcon className='ico' />
                          </button>
                          <button className='chat-hover-btn' onClick={() => setForwardTarget(msg)}>
                            <ForwardIcon className='ico' />
                          </button>
                          <button className='chat-hover-btn' onClick={() => handleCopy(msg)}>
                            {copiedMessageId === msg.messageId ? <AcceptIcon className='ico copied' /> : <CopyIcon className='ico' />}
                          </button>
                          {isMine && (
                            <button className='chat-hover-btn' onClick={() => startEdit(msg)}>
                              <Edit className='ico' />
                            </button>
                          )}
                          <div className='chat-hover-more-wrapper'>
                            <button
                              className='chat-hover-btn'
                              onClick={() => setOpenMenuId(openMenuId === msg.messageId ? null : msg.messageId)}
                            >
                              <MoreIcon className='ico' />
                            </button>
                            {openMenuId === msg.messageId && (
                              <div className={`chat-more-menu ${isMine ? 'align-right' : 'align-left'}`}>
                                <button onClick={() => { enterSelectionMode(msg.messageId); setOpenMenuId(null) }}>
                                  Выделить
                                </button>
                                <button onClick={() => { deleteForMeMutation.mutate(msg.messageId); setOpenMenuId(null) }}>
                                  Удалить у себя
                                </button>
                                {isMine && (
                                  <button
                                    className='danger'
                                    onClick={() => {
                                      if (window.confirm('Удалить сообщение у всех?')) deleteMutation.mutate(msg.messageId)
                                      setOpenMenuId(null)
                                    }}
                                  >
                                    Удалить у всех
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div
                        className='chat-message-bubble'
                        ref={(el) => {
                          if (el) messageBubbleRefs.current.set(msg.messageId, el)
                          else messageBubbleRefs.current.delete(msg.messageId)
                        }}
                      >
                        {msg.isForwarded && (
                          <p className='chat-forwarded-label'>Переслано от {msg.forwardedFromNickname || 'Пользователь'}</p>
                        )}

                        {msg.parentMessageId && (
                          <div
                            className='chat-reply-quote'
                            onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.parentMessageId!) }}
                          >
                            <p className='quote-author'>{msg.parentNickname || 'Пользователь'}</p>
                            <p className='quote-text'>{msg.parentContent || 'Сообщение удалено'}</p>
                          </div>
                        )}

                        <p className={`chat-message-content ${msg.isDeleted ? 'deleted' : ''}`}>
                          {msg.isDeleted ? 'Сообщение удалено' : msg.content}
                        </p>
                        <div className='chat-message-meta'>
                          <span className='chat-message-time'>
                            {new Date(msg.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.isEdited && <span className='chat-message-edited'>изменено</span>}
                          {isMine && !msg.isDeleted && (() => {
                            const status = getMessageStatus(msg, otherLastReadAt)
                            return (
                              <span className={`chat-message-status ${status}`}>
                                {status === 'wait' && <WaitIcon className='ico' />}
                                {status === 'sent' && <SentIcon className='ico' />}
                                {status === 'read' && <ReadIcon className='ico' />}
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Fragment>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {(replyingTo || editingMessageId) && (
        <div className='chat-context-preview'>
          <div className='chat-context-preview-content'>
            <p className='chat-context-label'>
              {editingMessageId ? 'Редактирование' : `Ответ для ${replyingTo?.nickname || 'Пользователь'}`}
            </p>
            <p className='chat-context-text'>
              {editingMessageId ? messages.find(m => m.messageId === editingMessageId)?.content : replyingTo?.content}
            </p>
          </div>
          <button className='chat-context-close' onClick={() => { setReplyingTo(null); cancelEdit() }}>
            <Reject className='ico' />
          </button>
        </div>
      )}

      <div className='chat-input-wrapper'>
        <textarea
          ref={textareaRef}
          className='chat-textarea'
          placeholder='Написать сообщение...'
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
        />
        <button
          className='chat-btn send'
          onClick={handleSubmit}
          disabled={!newMessage.trim() || sendMutation.isPending || updateMutation.isPending}
        >
          {editingMessageId ? 'Изменить' : 'Отправить'}
        </button>
      </div>

      {forwardTarget && (
        <div className='chat-forward-overlay' onClick={() => setForwardTarget(null)}>
          <div className='chat-forward-modal' onClick={(e) => e.stopPropagation()}>
            <div className='chat-forward-header'>
              <p>Переслать в чат</p>
              <button onClick={() => setForwardTarget(null)}>
                <Reject className='ico' />
              </button>
            </div>
            <div className='chat-forward-list'>
              {conversations
                .filter(c => c.conversationId !== conversationId)
                .map(c => (
                  <div
                    key={c.conversationId}
                    className='chat-forward-item'
                    onClick={() => {
                      if (Array.isArray(forwardTarget)) {
                        Promise.all(forwardTarget.map(id =>
                          forwardMutation.mutateAsync({ sourceMessageId: id, targetConversationId: c.conversationId })
                        )).then(() => exitSelectionMode())
                      } else {
                        forwardMutation.mutate({ sourceMessageId: (forwardTarget as MessageData).messageId, targetConversationId: c.conversationId })
                      }
                    }}
                  >
                    <img src={c.otherUserAvatarUrl || '/default-avatar.png'} alt='' />
                    <span>{c.otherUserNickname || 'Пользователь'}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}