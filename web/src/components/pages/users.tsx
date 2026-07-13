import './template_search.scss'
import './users.scss'

import NotFoundContentIcon from '@icons/not_found_content.svg?react'

import { useState } from 'react'
import InviteForm from '../forms/invite_user'
import type { UserData } from '../services/users'
import { UserCard } from '../common/userCard'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { usersApi } from '../services/users'

const FoundCount = ({ count }: { count: number }) => {
  return (
    <div className='content-item-count-container'>
      <p className='content-item-count-text'> Найдено: </p>
      <p className='content-item-count-text' id="count"> {count} </p>
    </div>
  )
}

const FoundContent = () => {
  const [showInviteForm, setShowInviteForm] = useState<UserData | null>(null)
  
  const { 
    data: users = [], 
  } = useQuery({
    queryKey: queryKeys.users.allList(),
    queryFn: () => usersApi.getAll(),
    staleTime: 0, 
    refetchOnMount: 'always', 
    refetchOnWindowFocus: true,
  })

  return (
    <div className='found-content-container'>
      <FoundCount count={users.length} />
      
      <div className='content-item-container'>
        {users.length === 0 ? (
          <>
            <NotFoundContentIcon className='content-zero-ico' />
            <p className='content-zero-text'>
              Упс! Кажется, здесь пока пусто.<br />
              Попробуй другой запрос
            </p>
          </>
        ) : (
          users.map(user => (
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
  )
}

export default function QueryContent () {
  return <FoundContent />
}