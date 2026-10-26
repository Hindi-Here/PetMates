import './template_search.scss'
import './users.scss'

import NotFoundContentIcon from '@icons/not_found_content.svg?react'

import { useState } from 'react'
import InviteForm from '../forms/invite_user'
import type { UserData } from '../services/users'
import { UserCard } from '../common/userCard'
import Search from '../common/search'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { usersApi } from '../services/users'
import { useSystemRole } from '../hooks/useSystemRole'
import { STALE } from '../scripts/query/queryClient'

const FoundCount = ({ count }: { count: number }) => (
  <div className='content-item-count-container'>
    <p className='content-item-count-text'> Найдено: </p>
    <p className='content-item-count-text' id="count"> {count} </p>
  </div>
)

// Компонент страницы со списком пользователей, включая поиск, фильтрацию и сортировку
export default function Users() {
  const [showInviteForm, setShowInviteForm] = useState<UserData | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [searchField, setSearchField] = useState('name')
  const [sortField, setSortField] = useState('date')
  const [isSortUp, setIsSortUp] = useState(true)

  const currentSystemRole = useSystemRole()
  const isStaff = currentSystemRole === 'moderator' || currentSystemRole === 'admin'
  const [showBannedOnly, setShowBannedOnly] = useState(false)
  const [showStaffOnly, setShowStaffOnly] = useState(false)

  const { data: users = [] } = useQuery({
    queryKey: [...queryKeys.users.allList(), appliedSearch, searchField, sortField, isSortUp, showBannedOnly, showStaffOnly],
    queryFn: () => usersApi.getAll({
      search: appliedSearch,
      searchField,
      sortField,
      sortAsc: isSortUp,
      showBannedOnly,
      showStaffOnly,
    }),
    staleTime: STALE.medium,
    placeholderData: keepPreviousData,
  })

  const filteredUsers = users

  return (
    <>
      <Search
        activeId='users'
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        onSearchSubmit={() => setAppliedSearch(searchInput)}
        selectedSearchId={searchField}
        onSearchFieldSelect={setSearchField}
        selectedSortId={sortField}
        onSortFieldSelect={setSortField}
        isSortUp={isSortUp}
        onToggleSortDirection={() => setIsSortUp(prev => !prev)}
        showBannedFilter={isStaff}
        showBannedOnly={showBannedOnly}
        onToggleShowBannedOnly={() => setShowBannedOnly(prev => !prev)}
        showStaffFilter={true}
        showStaffOnly={showStaffOnly}
        onToggleShowStaffOnly={() => setShowStaffOnly(prev => !prev)}
      />

      <div className='found-content-container'>
        <FoundCount count={filteredUsers.length} />

        <div className='content-item-container'>
          {filteredUsers.length === 0 ? (
            <>
              <NotFoundContentIcon className='content-zero-ico' />
              <p className='content-zero-text'>
                Упс! Кажется, здесь пока пусто.<br />
                Попробуй другой запрос
              </p>
            </>
          ) : (
            filteredUsers.map(user => (
              <UserCard key={user.userId} user={user} onInvite={setShowInviteForm} />
            ))
          )}
        </div>

        {showInviteForm && (
          <InviteForm
            onClose={() => setShowInviteForm(null)}
            invitedUser={showInviteForm}
          />
        )}
      </div>
    </>
  )
}