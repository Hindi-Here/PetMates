import './template_search.scss'
import './users.scss'

import NotFoundContentIcon from '@icons/not_found_content.svg?react'

import { useState, useMemo } from 'react'
import InviteForm from '../forms/invite_user'
import type { UserData } from '../services/users'
import { UserCard } from '../common/userCard'
import Search from '../common/search'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { usersApi } from '../services/users'

const FoundCount = ({ count }: { count: number }) => (
  <div className='content-item-count-container'>
    <p className='content-item-count-text'> Найдено: </p>
    <p className='content-item-count-text' id="count"> {count} </p>
  </div>
)

export default function Users() {
  const [showInviteForm, setShowInviteForm] = useState<UserData | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [searchField, setSearchField] = useState('name')
  const [sortField, setSortField] = useState('date')
  const [isSortUp, setIsSortUp] = useState(true)

  const { data: users = [] } = useQuery({
    queryKey: [...queryKeys.users.allList(), appliedSearch, searchField, sortField, isSortUp],
    queryFn: () => usersApi.getAll({
     search: appliedSearch,
      searchField,
      sortField,
      sortAsc: isSortUp,
    }),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })

  const filteredUsers = useMemo(() => {
    let result = [...users]

    const query = appliedSearch.trim().toLowerCase()
    if (query) {
      result = result.filter(u => {
        if (searchField === 'name') {
          return (u.nickname?.toLowerCase().includes(query)) ||
                 (u.realName?.toLowerCase().includes(query))
        }
        if (searchField === 'tag') {
          return (u.hardSkills as unknown as string[] | undefined)?.some(tag => tag.toLowerCase().includes(query))
        }
        if (searchField === 'role') {
          return u.profileRole?.toLowerCase().includes(query)
        }
        return true
      })
    }

    result.sort((a, b) => {
      let compare = 0
      if (sortField === 'date') {
        compare = new Date((a as any).createdAt ?? 0).getTime() - new Date((b as any).createdAt ?? 0).getTime()
      }
      else if (sortField === 'alphabet') {
        compare = (a.nickname || '').localeCompare(b.nickname || '')
      }
      else if (sortField === 'activity') {
        compare = new Date(a.lastOnlineAt ?? 0).getTime() - new Date(b.lastOnlineAt ?? 0).getTime()
      }
      return isSortUp ? compare : -compare
    })

    return result
  }, [users, appliedSearch, searchField, sortField, isSortUp])

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