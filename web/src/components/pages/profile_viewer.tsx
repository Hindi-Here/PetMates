import './profile_public_view.scss'
import LockIcon from '@icons/lock.svg?react'

import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSystemRole } from '../hooks/useSystemRole'
import { queryKeys } from '../scripts/query/queryKeys'
import { usersApi, type UserData } from '../services/users'
import type { ThirdProfileData } from '../services/profile'
import { ProfilePublicView, type ProfilePublicData } from './profile_public_view'
import { STALE } from '../scripts/query/queryClient'

export default function ProfileViewer() {
  const { profileId } = useParams<{ profileId: string }>()
  const currentSystemRole = useSystemRole()

  const { data: user, isLoading } = useQuery<ThirdProfileData>({
    queryKey: queryKeys.users.byId(profileId!),
    queryFn: () => usersApi.getUserById(profileId!),
    enabled: !!profileId,
    staleTime: STALE.medium,
  })

  const isStaff = currentSystemRole === 'admin' || currentSystemRole === 'moderator'
  const isBanned = (user as UserData)?.isBanned === true

  if (!isLoading && !isStaff && (!user || isBanned)) {
    return (
      <div className='banned-gate'>
        <div className='info-container'>
          <LockIcon className='info-ico' />
          <p className='info-comment'>Профиль недоступен</p>
          <p className='info-subcomment'>Пользователь заблокирован администрацией</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return <ProfilePublicView user={user as ProfilePublicData} />
}