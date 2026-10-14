import './event_page.scss'

export interface EventTabItem {
  id: string
  label: string
}

export const EVENT_TABS: readonly EventTabItem[] = [
  { id: 'info', label: 'Общее' },
  { id: 'form', label: 'Форма' },
  { id: 'members', label: 'Участники' },
  { id: 'applications', label: 'Заявки' },
  { id: 'results', label: 'Результаты' },
]

export const PUBLIC_EVENT_TABS = EVENT_TABS.filter(t => t.id !== 'applications')

interface EventTabsProps {
  tabs: readonly EventTabItem[]
  active: string
  onSelect: (id: string) => void
}

// Компонент для отображения вкладок мероприятия
export const EventTabs = ({ tabs, active, onSelect }: EventTabsProps) => (
  <div className='event-tabs'>
    {tabs.map(t => (
      <button
        key={t.id}
        className={`event-tab ${active === t.id ? 'active' : ''}`}
        onClick={() => onSelect(t.id)}
      >
        {t.label}
      </button>
    ))}
  </div>
)