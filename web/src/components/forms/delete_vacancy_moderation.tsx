import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import ImportantWarningIcon from '@icons/important_warning.svg?react'
import { useBlockScroll } from '../scripts/function'
import { moderationApi } from '../services/moderation'
import { useState } from 'react'

interface DeleteVacancyModerationFormProps {
  vacancyId: string
  vacancyTitle: string
  onClose: () => void
  onSuccess?: () => void
}

const Form = ({ vacancyId, vacancyTitle, onClose, onSuccess }: DeleteVacancyModerationFormProps) => {
  const [reason, setReason] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!reason.trim()) return
    try {
      setIsDeleting(true)
      await moderationApi.deleteVacancy(vacancyId, reason.trim())
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Ошибка удаления заявки:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className='form-container'>
      <div className='form-header-container red'>
        <ImportantWarningIcon className='form-header-ico' />
        <p className='form-header-text'>Удаление заявки (модерация)</p>
        <button className='form-header-close-button red' onClick={onClose}>
          <RejectIcon className='form-header-ico' />
        </button>
      </div>

      <div className='form-content-container'>
        <div className='form-info-container'>
          <p className='form-info-text'>
            <span className='form-info-text-title'>
              Удалить заявку «{vacancyTitle}»?
            </span>
            <br /><br />
            <span className='form-info-text-description'>
              Это действие нельзя будет отменить. Владелец получит уведомление с указанной причиной.
            </span>
          </p>
        </div>

        <div className='form-field-container'>
          <p className='form-field-text'>Причина удаления</p>
          <textarea
            className='form-field-input message red'
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder='Опишите причину — она будет показана владельцу заявки'
            rows={3}
          />
        </div>

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

export default function DeleteVacancyModerationForm(props: DeleteVacancyModerationFormProps) {
  useBlockScroll(true)
  return (
    <div className='dark-area-container' onClick={props.onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Form {...props} />
      </div>
    </div>
  )
}