import './project_third_side.scss'

import StarIcon from '@icons/star.svg?react'
import StatusEndIcon from '@icons/status_end.svg?react'
import StatusPauseIcon from '@icons/status_pause.svg?react'
import StatusWorkingIcon from '@icons/status_working.svg?react'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { UserData } from '../services/users'
import type { VacancyData } from '../services/vacancy'

import { VacancyCard } from '../common/vacancyCard'
import { UserCard } from '../common/userCard'

export interface TeamMemberWithUser {
  memberId: string; projectId: string; userId: string; role: string;
  joinedAt?: string; userData?: UserData; isOwner?: boolean
}

export interface TeamMember { id: number; email: string; role: string; isOwner?: boolean }

interface ProjectPreviewProps {
  name: string; shortDesc: string; status: string; description: string;
  team: Array<TeamMember | TeamMemberWithUser>; vacancies: VacancyData[]; 
  isOwner?: boolean; ratingCount?: number
}

export const ProjectPreview = ({ 
  name, status, description, team, vacancies, 
  isOwner = true, ratingCount = 0
}: ProjectPreviewProps) => {
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { text: string; className: string; Icon: React.ComponentType<{ className?: string }> }> = {
      'В процессе': { text: 'В процессе', className: 'status-working', Icon: StatusWorkingIcon },
      'Завершён': { text: 'Завершён', className: 'status-end', Icon: StatusEndIcon },
      'Приостановлен': { text: 'Приостановлен', className: 'status-pause', Icon: StatusPauseIcon }
    }
    return configs[status] || configs['В процессе']
  }
  const statusConfig = getStatusConfig(status); const StatusIcon = statusConfig.Icon

  return (
    <>
      <div className='project-preview-header'>
        <div className='project-info'>
          <h2 className='project-title'>О проекте {name}</h2>
          <div className={`project-status ${statusConfig.className}`}>
            <StatusIcon className='status-ico' />
            <span>{statusConfig.text}</span>
          </div>
        </div>
        <div className='project-actions'>
          <button className='rate-button' disabled={isOwner} style={isOwner ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
            Оценить
          </button>
          <div className='project-rating'>
            <StarIcon className='star-ico small' />
            <span>{ratingCount || 0} оценок</span>
          </div>
        </div>
      </div>

      {description && (
        <section className='preview-section'>
          <div className='project-description-preview markdown-content'>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
          </div>
        </section>
      )}
      {!description && (
        <div className='empty-state'><p className='empty-text'>Проект пока не заполнен</p></div>
      )}

      {team.length > 0 && (
        <section className='preview-section'>
          <h3 className='preview-section-title'>Команда: <span className='count'>{team.length}</span></h3>
          <div className='team-list-preview'>
            {team.map(member => {
              const key = 'memberId' in member ? member.memberId : String(member.id)
              const userData = 'userData' in member ? member.userData : undefined
              const isOwnerMember = member.isOwner || false
              const role = member.role || ''
              
              if (!userData) {
                return (
                  <div key={key} className='user-card-container loading'>
                    <div className='info-place-container'>
                      <div className='avatar-container'><div className='member-avatar-placeholder' /></div>
                      <div className='info-container'>
                        <div className='nickname-row'><p className='nickname-text'>Загрузка...</p></div>
                        <p className='role-text'>{role}</p>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <UserCard
                  key={key}
                  user={userData}
                  isOwner={isOwnerMember}
                  role={role}
                  disabledInvite={true}
                />
              )
            })}
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
    </>
  )
}