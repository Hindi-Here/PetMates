import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import ImportantWarningIcon from '@icons/important_warning.svg?react'
import { useBlockScroll } from '../scripts/function'
import { eventApi } from '../services/event'
import { useState } from 'react'

interface DeleteEventFormProps {
  eventId: string
  onClose: () => void
  onSuccess?: () => void
}

// Компонент формы удаления мероприятия (для владельца мероприятия)
const Form = ({ eventId, onClose, onSuccess }: DeleteEventFormProps) => {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (isDeleting) return
    try {
      setIsDeleting(true)
      await eventApi.delete(eventId)
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Ошибка удаления мероприятия:', error)
      setIsDeleting(false)
    }
  }

  return (
    <div className='form-container'>
      <div className='form-header-container red'>
        <ImportantWarningIcon className='form-header-ico' />
        <p className='form-header-text'> Удаление мероприятия </p>
        <button className='form-header-close-button red' onClick={onClose}>
          <RejectIcon className='form-header-ico' />
        </button>
      </div>

      <div className='form-content-container'>
        <div className='form-info-container'>
          <p className='form-info-text'>
            <span className='form-info-text-title'>
              Вы действительно хотите удалить это мероприятие?
            </span>
            <br /> <br />
            <span className='form-info-text-description'>
              Это действие нельзя будет отменить, а все связанные данные будут безвозвратно удалены.
            </span>
          </p>
        </div>

        <div className='form-manage'>
          <button className='form-manage-button red' onClick={handleDelete} disabled={isDeleting}>
            Удалить
          </button>
          <button className='form-manage-button cancellation' onClick={onClose} disabled={isDeleting}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DeleteEventForm({ eventId, onClose, onSuccess }: DeleteEventFormProps) {
  useBlockScroll(true)
  return (
    <div className='dark-area-container' onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Form eventId={eventId} onClose={onClose} onSuccess={onSuccess} />
      </div>
    </div>
  )
}