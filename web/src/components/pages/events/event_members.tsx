import './event_members.scss'
import '../project.scss'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../scripts/query/queryKeys'
import { eventApi } from '../../services/event'
import type { UserData } from '../../services/users'
import { UserCard } from '../../common/userCard'
import InviteForm from '../../forms/invite_user'
import { STALE } from '@/components/scripts/query/queryClient'

interface EventMembersProps {
  eventId: string
  participantLimit?: number | null
}

// Компонент для отображения списка участников мероприятия
export const EventMembers = ({ eventId, participantLimit }: EventMembersProps) => {
  const [inviteUser, setInviteUser] = useState<UserData | null>(null)

  const { data } = useQuery({
    queryKey: queryKeys.events.members(eventId),
    queryFn: () => eventApi.getMembers(eventId),
    staleTime: STALE.short,
  })

  const organizer = data?.organizer
  const members = data?.members ?? []

  return (
    <>
      {organizer && (
        <section className='project-section'>
          <h2 className='project-section-title'>Организатор</h2>
          <div className='event-members-list'>
            <UserCard user={organizer} isOwner ownerLabel='Организатор' onInvite={setInviteUser} />
          </div>
        </section>
      )}

      <section className='project-section'>
        <h2 className='project-section-title'>
          Участники:{' '}
          <span className='project-count'>
            {members.length}
            {participantLimit ? ` / ${participantLimit}` : ''}
          </span>
        </h2>

        {members.length === 0 ? (
          <div className='empty-state'>
            <p className='empty-text'>В мероприятии пока нет участников</p>
          </div>
        ) : (
          <div className='event-members-list'>
            {members.map(member => (
              <UserCard key={member.userId} user={member} onInvite={setInviteUser} />
            ))}
          </div>
        )}
      </section>

      {inviteUser && (
        <InviteForm onClose={() => setInviteUser(null)} invitedUser={inviteUser} />
      )}
    </>
  )
}