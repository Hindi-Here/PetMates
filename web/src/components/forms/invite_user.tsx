import './invite_user.scss'
import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import InviteInProjectIcon from '@icons/invite_in_project.svg?react'
import AcceptIcon from '@icons/accept.svg?react'

import { useState, useEffect } from 'react'
import { useBlockScroll } from '../scripts/function'
import { projectsApi } from '../services/project'
import { vacanciesApi, type VacancyData } from '../services/vacancy'
import { projectMembersApi } from '../services/project_members'
import { useAuth } from '../hooks/useAuth'
import { inviteApi } from '../services/invite'
import { usersApi } from '../services/users'
import { notificationApi } from '../services/notification'

import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'

interface Project {
  projectId: string
  title: string
  memberCount: number
}

// Отправка уведомления пользователю
const sendNotification = (
  userId: string,
  referenceType: string,
  referenceId: string,
  eventType: string,
  contextData: Record<string, any>
) => {
  notificationApi.create({
    userId,
    referenceType,
    referenceId,
    contextData: {
      ...contextData,
      eventType,
    }
  }).catch(err => console.error('Ошибка создания уведомления:', err))
}

// Рендер формы приглашения пользователя в проект
const Form = ({ onClose, invitedUser }: any) => {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [vacancies, setVacancies] = useState<VacancyData[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedVacancy, setSelectedVacancy] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [existingMembers, setExistingMembers] = useState<Set<string>>(new Set())
  const [existingInvites, setExistingInvites] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string>('')
  const [currentUserNickname, setCurrentUserNickname] = useState<string | null>(null)

  // Получение никнейма текущего пользователя
  useEffect(() => {
    const fetchNickname = async () => {
      if (!userId) return
      try {
        const user = await usersApi.getUserById(userId)
        setCurrentUserNickname(user?.nickname || null)
      } catch (error) {
        console.error('Ошибка получения никнейма:', error)
      }
    }
    fetchNickname()
  }, [userId])

  // Загрузка проектов пользователя
  useEffect(() => {
    const fetchProjects = async () => {
      if (!userId) return
      try {
        const userProjects = await projectsApi.getProjectsByUser(userId)
        
        const projectsWithMembers = await Promise.all(
          userProjects.map(async (project: any) => {
            try {
              const members = await projectMembersApi.getByProject(project.projectId)
              return {
                ...project,
                memberCount: members.length
              }
            } catch {
              return { ...project, memberCount: 0 }
            }
          })
        )
        
        setProjects(projectsWithMembers)
      } catch (error) {
        console.error('Ошибка загрузки проектов:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProjects()
  }, [userId])

  // Загрузка вакансий выбранного проекта
  useEffect(() => {
    let isCancelled = false
    
    const fetchVacancies = async () => {
      if (!selectedProject) {
        if (!isCancelled) {
          setVacancies([])
          setSelectedVacancy('')
          setExistingMembers(new Set<string>())
          setExistingInvites(new Set<string>())
        }
        return
      }
    
      if (!isCancelled) {
        setExistingMembers(new Set<string>()) 
        setExistingInvites(new Set<string>())
      }
    
      try {
        const projectVacancies = await vacanciesApi.getByProject(selectedProject)
        if (isCancelled) return
        
        if (!isCancelled) {
          setVacancies(projectVacancies)
          setSelectedVacancy('')
        }
        
        const members = await projectMembersApi.getByProject(selectedProject)
        if (isCancelled) return
        
        const memberIds = new Set<string>(members.map((m: any) => m.userId))
        if (!isCancelled) {
          setExistingMembers(memberIds)
        }
        
        const outgoingInvites = await inviteApi.getOutgoing()
        if (isCancelled) return
        
        const pendingInvitesForProject = outgoingInvites
          .filter(invite => invite.projectId === selectedProject && invite.status === 'pending')
          .map(invite => invite.userId)
        
        if (!isCancelled) {
          setExistingInvites(new Set<string>(pendingInvitesForProject))
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Ошибка загрузки вакансий:', error)
          setVacancies([])
          setExistingMembers(new Set<string>())
          setExistingInvites(new Set<string>())
        }
      }
    }
    
    fetchVacancies()
    
    return () => {
      isCancelled = true
    }
  }, [selectedProject])

  // Проверка: можно ли отправить приглашение
  const canInvite = selectedProject !== '' && 
                    selectedVacancy !== '' && 
                    invitedUser && 
                    !existingMembers.has(invitedUser.userId) &&
                    !existingInvites.has(invitedUser.userId)

  // Отправка приглашения пользователю
  const handleInvite = async () => {
    if (!canInvite || !invitedUser || !userId) return
    
    setError('')
    
    try {
      const selectedVacancyData = vacancies.find(v => v.vacancyId === selectedVacancy)
      const role = selectedVacancyData?.title ?? 'Участник проекта'
      const selectedProjectData = projects.find(p => p.projectId === selectedProject)
      const projectName = selectedProjectData?.title || 'Проект'
      
      await inviteApi.create({
        userId: invitedUser.userId,
        projectId: selectedProject,
        role: role
      })

      sendNotification(userId, 'invite', selectedProject, 'invite_sent', {
        projectName,
        vacancyName: selectedVacancyData?.title || 'Заявка',
      })
      
      sendNotification(invitedUser.userId, 'invite', selectedProject, 'invite_received', {
        projectName,
        vacancyName: selectedVacancyData?.title || 'Заявка',
        nickname: currentUserNickname || 'Пользователь',
      })
      
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications.all,
        refetchType: 'active'
      })
      
      onClose()
    } catch (error: any) {
      console.error('Ошибка создания приглашения:', error)
      setError(error.message || 'Не удалось отправить приглашение')
    }
  }

  return (
    <div className='form-container'> 
      <div className='form-header-container'>
        <InviteInProjectIcon className='form-header-ico'/>
        <p className='form-header-text'> Приглашение участника </p>
        <button className='form-header-close-button' onClick={onClose}>
          <RejectIcon className='form-header-close-ico' />
        </button>
      </div>

      <div className='form-content-container'>
        <div className='form-field-container'>
          <p className='form-field-label'> Выберите проект </p>
          
          {isLoading ? (
            <div className='project-loading'>Загрузка проектов...</div>
          ) : projects.length === 0 ? (
            <div className='project-empty'>
              <p>Отсутствуют проекты для выбора</p>
            </div>
          ) : (
            <div className='project-list'>
              {projects.map(project => (
                <div 
                  key={project.projectId}
                  className={`project-item ${selectedProject === project.projectId ? 'selected' : ''}`}
                  onClick={() => setSelectedProject(project.projectId)}
                >
                  <div className='project-avatar'>
                    {project.title.charAt(0).toUpperCase()}
                  </div>
                  <div className='project-info'>
                    <p className='project-title'>{project.title}</p>
                    <p className='project-members'>
                      {project.memberCount} участников
                    </p>
                  </div>
                  {selectedProject === project.projectId && (
                    <div className='project-checkmark'>
                      <AcceptIcon className='checkmark-icon' />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='form-field-container'>
          <p className='form-field-label'> Выберите вакансию </p>
          
          {!selectedProject ? (
            <div className='vacancy-placeholder'>
              <p>Выберите проект для отображения вакансий</p>
            </div>
          ) : vacancies.length === 0 ? (
            <div className='vacancy-empty'>
              <p>В этом проекте нет вакансий</p>
            </div>
          ) : (
            <div className='invite-vacancy-list'>
              {vacancies.map(vacancy => {
                const isAlreadyMember = existingMembers.has(invitedUser?.userId)
                return (
                  <div 
                    key={vacancy.vacancyId}
                    className={`invite-vacancy-item ${selectedVacancy === vacancy.vacancyId ? 'selected' : ''} ${isAlreadyMember ? 'disabled' : ''}`}
                    onClick={() => !isAlreadyMember && setSelectedVacancy(vacancy.vacancyId)}
                  >
                    <div className='invite-vacancy-avatar'>
                      {vacancy.title.charAt(0).toUpperCase()}
                    </div>
                    <div className='invite-vacancy-info'>
                      <p className='invite-vacancy-title'>{vacancy.title}</p>
                      <p className='invite-vacancy-date'>
                        {vacancy.publishedAt ? new Date(vacancy.publishedAt).toLocaleDateString('ru-RU') : 'Дата не указана'}
                      </p>
                    </div>
                    {selectedVacancy === vacancy.vacancyId && (
                      <div className='invite-vacancy-checkmark'>
                        <AcceptIcon className='checkmark-icon' />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {error && (
          <p className='invite-error-text'>{error}</p>
        )}

        {invitedUser && !error && (
          existingMembers.has(invitedUser.userId) ? (
            <p className='invite-error-text'>Этот пользователь уже является участником проекта</p>
          ) : existingInvites.has(invitedUser.userId) ? (
            <p className='invite-error-text'>Приглашение уже отправлено этому пользователю</p>
          ) : null
        )}

        <div className='form-manage'>
          <button className='form-manage-button' disabled={!canInvite} onClick={handleInvite}> 
            Пригласить 
          </button>
          <button className='form-manage-button cancellation' onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

// Рендер модального окна приглашения с блокировкой скролла
export default function InviteUserForm({ onClose, invitedUser }: any) {
  useBlockScroll(true)
  return (
    <div className='dark-area-container' onClick={onClose}> 
      <div onClick={(e) => e.stopPropagation()}>
        <Form onClose={onClose} invitedUser={invitedUser}/>
      </div>
    </div>
  )
}