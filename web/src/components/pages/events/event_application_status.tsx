import './event_applications.scss'
import type { ApplicationStatus } from '../../services/event'

export const APPLICATION_STATUS: Record<ApplicationStatus, { label: string }> = {
  pending: { label: 'На рассмотрении' },
  revision: { label: 'На доработке' },
  accepted: { label: 'Принята' },
  rejected: { label: 'Отклонена' },
}

// Компонент для отображения статуса заявки на участие в мероприятии с соответствующей меткой
export const ApplicationStatusBadge = ({ status }: { status: ApplicationStatus }) => (
  <span className={`event-app-status ${status}`}>{APPLICATION_STATUS[status]?.label ?? status}</span>
)