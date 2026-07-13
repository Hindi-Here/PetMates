import './project_third_side.scss'

import StarIcon from '@icons/star.svg?react'
import StatusEndIcon from '@icons/status_end.svg?react'
import StatusPauseIcon from '@icons/status_pause.svg?react'
import StatusWorkingIcon from '@icons/status_working.svg?react'

import { useState, useEffect  } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { UserData } from '../services/users'
import { projectsApi } from '../services/project'
import { projectMembersApi } from '../services/project_members'
import { usersApi } from '../services/users'
import { vacanciesApi } from '../services/vacancy'
import { useAuth } from '../hooks/useAuth'
import InviteUserForm from '../forms/invite_user'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'

import { VacancyCard } from '../common/vacancyCard'
import { UserCard } from '../common/userCard'

export interface TeamMemberWithUser {
  memberId: string; projectId: string; userId: string; role: string;
  joinedAt?: string; userData?: UserData; isOwner?: boolean
}

export default function ProjectThirdSide() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  
  const [hasRated, setHasRated] = useState(false)
  const [isRatingLoading, setIsRatingLoading] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState<UserData | null>(null)
  
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
        return {
          ...old,
          ratingCount: result.ratingCount
        }
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
            <UserCard
              key={member.memberId}
              user={member.userData}
              isOwner={member.isOwner}
              role={member.role}
              disabledInvite={true}
            />
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

      <div className='manage-container'>
        <button className='return-button' onClick={handleBack}>Вернуться</button>
      </div>

      {showInviteForm && (
        <InviteUserForm
          onClose={() => setShowInviteForm(null)}
          invitedUser={showInviteForm}
        />
      )}
    </div>
  )
}