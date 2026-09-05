import Add from '@icons/plus.svg?react'
import StarIcon from '@icons/star.svg?react'
import UsersIcon from '@icons/users.svg?react'
import CalendarIcon from '@icons/calendar.svg?react'
import StatusEndIcon from '@icons/status_end.svg?react'
import StatusPauseIcon from '@icons/status_pause.svg?react'
import StatusWorkingIcon from '@icons/status_working.svg?react'
import LockIcon from '@icons/lock.svg?react'
import RejectIcon from '@icons/reject.svg?react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSystemRole } from '../hooks/useSystemRole'
import type { ProjectData } from '../services/project'
import './activity.scss'
import { useMemo, useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { projectsApi } from '../services/project'
import { usersApi } from '../services/users'
import { canModerateTarget } from '../scripts/moderation'
import DeleteProjectModerationForm from '../forms/delete_project_moderation'

// Получение конфигурации статуса проекта (текст, класс, иконка)
const getStatusConfig = (status: string) => {
  const configs: Record<string, {
    text: string;
    className: string;
    Icon: React.ComponentType<{ className?: string }>
  }> = {
    'В процессе': { text: 'В процессе', className: 'status-in-progress', Icon: StatusWorkingIcon },
    'Завершён': { text: 'Завершён', className: 'status-completed', Icon: StatusEndIcon },
    'Приостановлен': { text: 'Приостановлен', className: 'status-paused', Icon: StatusPauseIcon }
  }
  return configs[status] || configs['В процессе']
}

// Карточка проекта для отображения в списке
const ProjectCard = ({
  project,
  showModerationDelete = false
}: {
  project: ProjectData
  showModerationDelete?: boolean
}) => {
  const navigate = useNavigate()
  const { userId: authUserId } = useAuth()
  const { profileId } = useParams<{ profileId: string }>()
  const queryClient = useQueryClient()
  const currentSystemRole = useSystemRole()
  const [projectOwnerRole, setProjectOwnerRole] = useState<string | null>(null)
  const [ownerIsBanned, setOwnerIsBanned] = useState(false)
  const [showDeleteForm, setShowDeleteForm] = useState(false)

  const statusConfig = getStatusConfig(project.status)
  const StatusIcon = statusConfig.Icon

  useEffect(() => {
    const fetchOwnerInfo = async () => {
      try {
        const owner = await usersApi.getUserById(project.ownerId)
        setProjectOwnerRole((owner as any).systemRole || 'user')
        setOwnerIsBanned((owner as any).isBanned === true)
      } catch (error) {
        setProjectOwnerRole('user')
        setOwnerIsBanned(true) 
      }
    }
    fetchOwnerInfo()
  }, [project.ownerId])

  const canModerate = showModerationDelete &&
    !project.isPrivate &&
    canModerateTarget(currentSystemRole, projectOwnerRole)

  const handleModerationDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteForm(true)
  }

  const handleClick = () => {
    const ownerId = profileId || authUserId
    const path = `/profile/${ownerId}/activity/project/${project.projectId}`
    navigate(path)
  }

  return (
    <>
      <div 
        className={`project-card 
          ${canModerate ? 'with-moderation' : ''} 
          ${ownerIsBanned ? 'banned-owner-card' : ''}`}
        onClick={handleClick}
      >
        {canModerate && (
          <button
            className='project-moderation-delete-btn'
            onClick={handleModerationDelete}
          >
            <RejectIcon className='ico' />
          </button>
        )}

        <div className="project-card-header">
          <h3 className="project-card-title">
            {project.title}
            {project.isPrivate && <LockIcon className="private-icon" />}
          </h3>
          <span className={`project-card-status ${statusConfig.className}`}>
            <StatusIcon className="status-icon" />
            {statusConfig.text}
          </span>
        </div>

        {project.shortDescription && (
          <p className="project-card-description">{project.shortDescription}</p>
        )}

        <div className="project-card-footer">
          <div className="project-card-meta">
            <span className="meta-item">
              <UsersIcon className="meta-icon" />
              {project.membersCount || 0} участников
            </span>
            <span className="meta-item">
              <StarIcon className="meta-icon" />
              {project.ratingCount} оценок
            </span>
          </div>

          {project.statusChangedAt && (
            <span className="project-card-date">
              <CalendarIcon className="meta-icon" />
              {new Date(project.statusChangedAt).toLocaleDateString('ru-RU')}
            </span>
          )}
        </div>
      </div>

      {showDeleteForm && (
        <DeleteProjectModerationForm
          projectId={project.projectId}
          projectTitle={project.title}
          onClose={() => setShowDeleteForm(false)}
          onSuccess={() => {
            const ownerId = profileId || authUserId
            if (ownerId) {
              queryClient.invalidateQueries({ queryKey: queryKeys.projects.byUser(ownerId) })
            }
          }}
        />
      )}
    </>
  )
}

// Страница активности
export const Activity = () => {
  const { userId: authUserId } = useAuth()
  const { profileId } = useParams<{ profileId: string }>()
  const currentSystemRole = useSystemRole()

  const ownerId = profileId || authUserId
  const isOwner = !profileId || profileId === authUserId
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: profileOwnerData, isLoading: ownerLoading } = useQuery({
    queryKey: ['users', 'byId', ownerId],
    queryFn: () => usersApi.getUserById(ownerId!),
    enabled: !!ownerId && !isOwner,
  })

  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.byUser(ownerId!),
    queryFn: () => projectsApi.getProjectsByUser(ownerId!),
    enabled: !!ownerId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const { data: memberProjects = [] } = useQuery({
    queryKey: queryKeys.projects.memberProjects(ownerId!),
    queryFn: () => projectsApi.getUserMemberProjects(ownerId!),
    enabled: !!ownerId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const { data: favorites = [] } = useQuery({
    queryKey: queryKeys.projects.favorites(ownerId!),
    queryFn: () => projectsApi.getUserFavorites(ownerId!),
    enabled: !!ownerId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const createProjectMutation = useMutation({
    mutationFn: (data: any) => projectsApi.createProject(data),
    onSuccess: (newProject) => {
      if (ownerId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.byUser(ownerId) })
      }
      navigate(`/profile/${authUserId}/activity/project/${newProject.projectId}`)
    },
    onError: (error) => {
      console.error('Ошибка создания проекта:', error)
    },
  })

  const handleCreateProject = async () => {
    if (!authUserId) return
    createProjectMutation.mutate({
      title: 'Unnamed',
      shortDescription: '',
      fullDescription: '',
      status: 'В процессе',
      ownerId: authUserId,
      isPrivate: false
    })
  }

  const filteredFavorites = useMemo(() => {
    const memberProjectIds = new Set((memberProjects as any[]).map((p: any) => p.projectId))
    return (favorites as any[]).filter((fav: any) => !memberProjectIds.has(fav.projectId))
  }, [favorites, memberProjects])

  const hasAnyProjects = (projects as any[]).length > 0 || (memberProjects as any[]).length > 0 || (filteredFavorites as any[]).length > 0

  const isStaff = currentSystemRole === 'admin' || currentSystemRole === 'moderator'
  const isBanned = (profileOwnerData as any)?.isBanned === true

  if (!isOwner && !isStaff) {
    if (ownerLoading) {
      return <div className="loading-container"></div>
    }
    if (!profileOwnerData || isBanned) {
      return (
        <div className='banned-gate'>
          <div className='info-container'>
            <LockIcon className='info-ico' />
            <p className='info-comment'>Активность недоступна</p>
            <p className='info-subcomment'>Пользователь заблокирован администрацией</p>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="activity-page">
      {!hasAnyProjects && !isOwner && (
        <div className="empty-activity">
          <UsersIcon className="empty-activity-ico" />
          <p className="empty-activity-text">У пользователя пока нет проектов</p>
        </div>
      )}

      {(isOwner || (projects as any[]).length > 0) && (
        <div className="activity-section">
          <div className="activity-header">
            <h2 className="section-title">
              {isOwner ? 'Мои проекты' : 'Проекты пользователя'}:{' '}
              <span className="projects-count">{(projects as any[]).length}</span>
            </h2>
          </div>

          {isOwner && (
            <button
              className="add-project-card"
              onClick={handleCreateProject}
              disabled={createProjectMutation.isPending}
            >
              <div className="add-icon-container">
                <Add className="add-icon" />
              </div>
              <span className="add-project-text">
                {createProjectMutation.isPending ? 'Создание...' : 'Создать новый проект'}
              </span>
            </button>
          )}

          <div className="projects-list">
            {(projects as any[]).map((project: any) => (
              <ProjectCard
                key={project.projectId}
                project={project}
                showModerationDelete={!isOwner && canModerateTarget(currentSystemRole, (profileOwnerData as any)?.systemRole)}
              />
            ))}
          </div>
        </div>
      )}

      {(memberProjects as any[]).length > 0 && (
        <div className="activity-section">
          <div className="activity-header">
            <h2 className="section-title">
              {isOwner ? 'Участник проектов' : 'Участник проектов'}:{' '}
              <span className="projects-count">{(memberProjects as any[]).length}</span>
            </h2>
          </div>

          <div className="projects-list">
            {(memberProjects as any[]).map((project: any) => (
              <ProjectCard key={project.projectId} project={project} />
            ))}
          </div>
        </div>
      )}

      {(filteredFavorites as any[]).length > 0 && (
        <div className="activity-section">
          <div className="activity-header">
            <h2 className="section-title">
              {isOwner ? 'Избранные проекты' : 'Избранные пользователя'}:{' '}
              <span className="projects-count">{(filteredFavorites as any[]).length}</span>
            </h2>
          </div>

          <div className="projects-list">
            {(filteredFavorites as any[]).map((project: any) => (
              <ProjectCard key={project.projectId} project={project} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}