import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import ImportantWarningIcon from '@icons/important_warning.svg?react'
import { useBlockScroll } from '../scripts/function'
import { eventApi } from '../services/event'
import { useState } from 'react'
import { LIMITS } from '../scripts/limits'
import { invalidateModeration } from '../scripts/query/invalidate'
import { useQueryClient } from '@tanstack/react-query'

interface DeleteEventModerationFormProps {
  eventId: string
  eventTitle: string
  onClose: () => void
  onSuccess?: () => void
}

// Компонент формы удаления мероприятия (модерация)
const Form = ({ eventId, eventTitle, onClose, onSuccess }: DeleteEventModerationFormProps) => {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!reason.trim() || isDeleting) return
    try {
      setIsDeleting(true)
      await eventApi.moderationDelete(eventId, reason.trim())
      await invalidateModeration(queryClient)
      onSuccess?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выполнить действие')
    }finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className='form-container'>
      <div className='form-header-container red'>
        <ImportantWarningIcon className='form-header-ico' />
        <p className='form-header-text'>Удаление мероприятия (модерация)</p>
        <button className='form-header-close-button red' onClick={onClose}>
          <RejectIcon className='form-header-ico' />
        </button>
      </div>

      <div className='form-content-container'>
        <div className='form-info-container'>
          <p className='form-info-text'>
            <span className='form-info-text-title'>
              Удалить мероприятие «{eventTitle}»?
            </span>
            <br /><br />
            <span className='form-info-text-description'>
              Это действие нельзя будет отменить. Владелец получит уведомление с указанной причиной.
            </span>
          </p>
        </div>

        <div className='form-field-container'>
          <div className='profile-area-text-container'>
            <div className='profile-area-text-wrapper'>
              <p className='profile-area-text'>Причина удаления<sup className='required-mark'>*</sup></p>
              <p className={`char-counter ${reason.length >= LIMITS.moderation.reasonMax ? 'limit' : ''}`}>
                {reason.length} / {LIMITS.moderation.reasonMax}
              </p>
            </div>
          </div>
          <textarea
            className='form-field-input message red'
            value={reason}
            maxLength={LIMITS.moderation.reasonMax}
            onChange={(e) => setReason(e.target.value)}
            placeholder='Опишите причину — она будет показана владельцу мероприятия'
            rows={3}
          />
        </div>

        {error && <p className='invite-error-text'>{error}</p>}
        <div className='form-manage'>
          <button
            className='form-manage-button red'
            onClick={handleDelete}
            disabled={isDeleting || !reason.trim()}
          >
            Удалить
          </button>
          <button
            className='form-manage-button cancellation'
            onClick={onClose}
            disabled={isDeleting}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DeleteEventModerationForm(props: DeleteEventModerationFormProps) {
  useBlockScroll(true)
  return (
    <div className='dark-area-container' onClick={props.onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Form {...props} />
      </div>
    </div>
  )
}