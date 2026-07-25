import './message.scss'
import UsersIcon from '@icons/users.svg?react'
import SearchIcon from '@icons/search.svg?react'
import Delete from '@icons/delete.svg?react'
import PinIcon from '@icons/pin.svg?react'
import UnpinIcon from '@icons/unpin.svg?react'

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { conversationApi } from '../services/conversation'
import { usersApi, type UserSearchResult } from '../services/users'

export const Messages = () => {
  const navigate = useNavigate()
  const { profileId } = useParams<{ profileId: string }>()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [globalQuery, setGlobalQuery] = useState('')

  const { data: conversations = [] } = useQuery({
    queryKey: queryKeys.conversations.all,
    queryFn: () => conversationApi.getConversations(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const { data: foundUsers = [] } = useQuery({
    queryKey: ['users', 'search', globalQuery],
    queryFn: () => usersApi.searchUsers(globalQuery),
    enabled: globalQuery.trim().length >= 2,
    staleTime: 0,
  })

  const togglePinMutation = useMutation({
    mutationFn: (conversationId: string) => conversationApi.togglePin(conversationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all }),
  })

  const hideMutation = useMutation({
    mutationFn: (conversationId: string) => conversationApi.hideConversation(conversationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all }),
  })

  const startConversationMutation = useMutation({
    mutationFn: (targetUserId: string) => conversationApi.startConversation(targetUserId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all })
      navigate(`/profile/${profileId}/messages/${data.conversationId}`)
    },
  })

  const handleOpenChat = (conversationId: string) => {
    navigate(`/profile/${profileId}/messages/${conversationId}`)
  }

  const handleSearchClick = () => {
    setGlobalQuery(searchQuery)
  }

  const filteredConversations = conversations.filter(conv =>
    !searchQuery.trim() ||
    (conv.otherUserNickname || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
  )

  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    
    const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    return timeB - timeA
  })

  const existingConversationUserIds = new Set(conversations.map(c => c.otherUserId))
  const newUsersFound: UserSearchResult[] = globalQuery.trim()
    ? foundUsers.filter(u => !existingConversationUserIds.has(u.userId))
    : []

    const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  const thisYearStart = new Date(now.getFullYear(), 0, 1);
  
  const isToday = date >= today;
  const isYesterday = date >= yesterday && date < today;
  const isThisWeek = date >= thisWeekStart && date < today;
  const isThisYear = date >= thisYearStart && date < today;
  
  if (isToday) {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  if (isYesterday) {
    return 'Вчера';
  }
  if (isThisWeek) {
    return date.toLocaleDateString('ru-RU', { weekday: 'short' });
  }
  if (isThisYear) {
    return date.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  }
  return date.toLocaleDateString('ru-RU', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
};

  return (
    <div className='messages-page'>
      <div className='search-content-container messages-search'>
        <div className='search-line-container'>
          <div className='search-input-container'>
            <SearchIcon className='search-ico' />
            <input
              className='search-input'
              placeholder='Поиск чата или пользователя'
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (!e.target.value.trim()) setGlobalQuery('')
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearchClick() }}
            />
          </div>
          <div className='search-button-container'>
            <button className='search-button' onClick={handleSearchClick}>Найти</button>
          </div>
        </div>
      </div>

      {globalQuery.trim() && newUsersFound.length > 0 && (
        <div className='messages-section'>
          <h3 className='messages-section-title'>Найденные пользователи</h3>
          <div className='found-users-list'>
            {newUsersFound.map(user => (
              <div
                key={user.userId}
                className='found-user-card'
                onClick={() => {
                  if (startConversationMutation.isPending) return
                  startConversationMutation.mutate(user.userId)
                }}
              >
                <div className='found-user-info'>
                  <div className='found-user-avatar'>
                    <img src={user.avatarUrl || '/default-avatar.png'} alt={user.nickname} />
                  </div>
                  <p className='found-user-nickname'>@{user.nickname}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className='messages-section'>
        <h3 className='messages-section-title'>
          Чаты: <span className='messages-count'>{sortedConversations.length}</span>
        </h3>

        {sortedConversations.length === 0 ? (
          <div className='empty-activity'>
            <UsersIcon className='empty-activity-ico' />
            <p className='empty-activity-text'>
              {searchQuery.trim() ? 'Ничего не найдено среди ваших чатов' : 'У вас пока нет переписок'}
            </p>
          </div>
        ) : (
          <div className='conversation-list'>
            {sortedConversations.map(conv => (
              <div
                key={conv.conversationId}
                className={`conversation-card ${conv.hasUnread ? 'unread' : ''}`}
                onClick={() => handleOpenChat(conv.conversationId)}
              >
                <div className='conversation-info-block'>
                  <div className='conversation-avatar'>
                    <img src={conv.otherUserAvatarUrl || '/default-avatar.png'} alt={conv.otherUserNickname || 'User'} />
                  </div>

                  <div className='conversation-info'>
                    <div className='conversation-top-row'>
                      <p className='conversation-nickname'>{conv.otherUserNickname || 'Пользователь'}</p>
                      {conv.lastMessageAt && (
                        <span className='conversation-date'>
                        {formatDate(conv.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <p className='conversation-preview'>
                      {conv.lastMessage || 'Нет сообщений'}
                    </p>
                  </div>
                </div>

                <div className='conversation-actions' onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`conversation-pin-btn ${conv.isPinned ? 'pinned' : ''}`}
                    onClick={() => togglePinMutation.mutate(conv.conversationId)}
                  >
                    {conv.isPinned ? <UnpinIcon className='ico' /> : <PinIcon className='ico' />}
                  </button>
                  <button
                    className='conversation-delete-btn'
                    onClick={() => {
                      if (window.confirm('Удалить переписку? Она пропадёт только у вас.')) {
                        hideMutation.mutate(conv.conversationId)
                      }
                    }}
                  >
                    <Delete className='ico' />
                  </button>
                </div>

                {conv.hasUnread && <div className='unread-dot' />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}