import Add from '@icons/plus.svg?react'
import StarIcon from '@icons/star.svg?react'
import UsersIcon from '@icons/users.svg?react'
import CalendarIcon from '@icons/calendar.svg?react'
import StatusEndIcon from '@icons/status_end.svg?react'
import StatusPauseIcon from '@icons/status_pause.svg?react'
import StatusWorkingIcon from '@icons/status_working.svg?react'
import LockIcon from '@icons/lock.svg?react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { ProjectData } from '../services/project'
import './activity.scss'
import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { projectsApi } from '../services/project'

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
const ProjectCard = ({ project }: { project: ProjectData }) => {
  const navigate = useNavigate()
  const { userId: authUserId } = useAuth()
  const { profileId } = useParams<{ profileId: string }>()

  const statusConfig = getStatusConfig(project.status)
  const StatusIcon = statusConfig.Icon

  // Навигация к странице проекта
  const handleClick = () => {
    const ownerId = profileId || authUserId
    const path = `/profile/${ownerId}/activity/project/${project.projectId}`
    navigate(path)
  }

  return (
    <div className="project-card" onClick={handleClick}>
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
  )
}

export const Activity = () => {
  const { userId: authUserId } = useAuth()
  const { profileId } = useParams<{ profileId: string }>()

  const ownerId = profileId || authUserId
  const isOwner = !profileId || profileId === authUserId
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Загрузка проектов, созданных пользователем
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.byUser(ownerId!),
    queryFn: () => projectsApi.getProjectsByUser(ownerId!),
    enabled: !!ownerId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  // Загрузка проектов, в которых пользователь участник
  const { data: memberProjects = [] } = useQuery({
    queryKey: queryKeys.projects.memberProjects(ownerId!),
    queryFn: () => projectsApi.getUserMemberProjects(ownerId!),
    enabled: !!ownerId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  // Загрузка избранных проектов пользователя
  const { data: favorites = [] } = useQuery({
    queryKey: queryKeys.projects.favorites(ownerId!),
    queryFn: () => projectsApi.getUserFavorites(ownerId!),
    enabled: !!ownerId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  // Мутация создания нового проекта
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

  // Создание проекта с дефолтными данными
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

  // Фильтрация избранных: исключить проекты, где пользователь участник
  const filteredFavorites = useMemo(() => {
    const memberProjectIds = new Set(memberProjects.map(p => p.projectId))
    return favorites.filter(fav => !memberProjectIds.has(fav.projectId))
  }, [favorites, memberProjects])

  // Проверка: есть ли у пользователя какие-либо проекты
  const hasAnyProjects = projects.length > 0 || memberProjects.length > 0 || filteredFavorites.length > 0

  return (
    <div className="activity-page">
      {!hasAnyProjects && !isOwner && (
        <div className="empty-activity">
          <UsersIcon className="empty-activity-ico" />
          <p className="empty-activity-text">У пользователя пока нет проектов</p>
        </div>
      )}

      {(isOwner || projects.length > 0) && (
        <div className="activity-section">
          <div className="activity-header">
            <h2 className="section-title">
              {isOwner ? 'Мои проекты' : 'Проекты пользователя'}:{' '}
              <span className="projects-count">{projects.length}</span>
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
            {projects.map(project => (
              <ProjectCard key={project.projectId} project={project} />
            ))}
          </div>
        </div>
      )}

      {memberProjects.length > 0 && (
        <div className="activity-section">
          <div className="activity-header">
            <h2 className="section-title">
              {isOwner ? 'Участник проектов' : 'Участник проектов'}:{' '}
              <span className="projects-count">{memberProjects.length}</span>
            </h2>
          </div>

          <div className="projects-list">
            {memberProjects.map(project => (
              <ProjectCard key={project.projectId} project={project} />
            ))}
          </div>
        </div>
      )}

      {filteredFavorites.length > 0 && (
        <div className="activity-section">
          <div className="activity-header">
            <h2 className="section-title">
              {isOwner ? 'Избранные проекты' : 'Избранные пользователя'}:{' '}
              <span className="projects-count">{filteredFavorites.length}</span>
            </h2>
          </div>

          <div className="projects-list">
            {filteredFavorites.map(project => (
              <ProjectCard key={project.projectId} project={project} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}