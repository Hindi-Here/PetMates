import '../project.scss'
import VacancyIcon from '@icons/vacancy.svg?react'
import DropdownIcon from '@icons/dropdown.svg?react'

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../scripts/query/queryKeys'
import { useIsOpen } from '../../scripts/function'
import { Dropdown } from '../../common/dropdown'
import { eventApi, type ApplicationListItem, type ApplicationStatus } from '../../services/event'
import { ApplicationStatusBadge } from './event_application_status'
import { STALE } from '@/components/scripts/query/queryClient'

type Filter = 'all' | ApplicationStatus

const FILTER_OPTIONS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'pending', label: 'Новые' },
  { id: 'revision', label: 'На доработке' },
  { id: 'accepted', label: 'Принятые' },
]

// Карточка заявки
const ApplicationCard = ({ item, onOpen }: { item: ApplicationListItem; onOpen: () => void }) => {
  const created = new Date(item.createdAt)

  return (
    <div className={`event-app-card ${item.status}`} onClick={onOpen}>
      <div className='event-app-card-head'>
        <div className='event-app-doc-ico'>
          <VacancyIcon className='ico' />
        </div>
        <div className='event-app-card-title'>
          <p className='event-app-card-name'>Заявка на участие</p>
          <p className='event-app-card-date'>
            Подана {created.toLocaleDateString('ru-RU')}, {created.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <ApplicationStatusBadge status={item.status} />
      </div>

      <div className='event-app-applicant'>
        <img src={item.applicant.avatarUrl || '/default-avatar.png'} alt={item.applicant.nickname} />
        <div className='event-app-applicant-info'>
          <p className='event-app-applicant-name'>@{item.applicant.nickname}</p>
          <p className='event-app-applicant-role'>{item.applicant.profileRole || 'Роль не указана'}</p>
        </div>
        {item.applicant.isBanned && <span className='event-app-banned'>Заблокирован</span>}
      </div>

      {item.snippet && (
        <p className='event-app-snippet'>
          <span className='event-app-snippet-label'>{item.snippetLabel}</span>
          {item.snippet}
        </p>
      )}

      <div className='event-app-open'>Открыть заявку <span>→</span></div>
    </div>
  )
}

interface EventApplicationsProps {
  eventId: string
  basePath: string
}

// Компонент для отображения списка заявок на участие в мероприятии с возможностью фильтрации по статусу
export const EventApplications = ({ eventId, basePath }: EventApplicationsProps) => {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const { isOpen, setIsOpen, menuRef } = useIsOpen()

  const { data: applications = [] } = useQuery({
    queryKey: queryKeys.events.applications(eventId),
    queryFn: () => eventApi.getApplications(eventId),
    staleTime: STALE.short,
  })

  const visible = useMemo(
    () => (filter === 'all' ? applications : applications.filter(a => a.status === filter)),
    [applications, filter]
  )

  const selected = FILTER_OPTIONS.find(o => o.id === filter) ?? FILTER_OPTIONS[0]

  return (
    <section className='project-section'>
      <div className='event-app-header'>
        <h2 className='project-section-title'>
          Заявки: <span className='project-count'>{visible.length}</span>
        </h2>

        <div className='sort-group-container' ref={menuRef}>
          <div className={`sort-type-container ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)}>
            <p className='sort-type-text'>{selected.label}</p>
            <DropdownIcon className={`sort-type-dropdown-ico ${isOpen ? 'rotated' : ''}`} />
          </div>
          <Dropdown
            items={FILTER_OPTIONS}
            isOpen={isOpen}
            onSelect={item => { setFilter(item.id as Filter); setIsOpen(false) }}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className='empty-state'>
          <p className='empty-text'>
            {applications.length === 0 ? 'Заявок пока нет' : 'Нет заявок с таким статусом'}
          </p>
        </div>
      ) : (
        <div className='event-app-list'>
          {visible.map(item => (
            <ApplicationCard
              key={item.applicationId}
              item={item}
              onOpen={() => navigate(`${basePath}/applications/${item.applicationId}`)}
            />
          ))}
        </div>
      )}
    </section>
  )
}