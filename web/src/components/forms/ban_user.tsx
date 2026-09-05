import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import ImportantWarningIcon from '@icons/important_warning.svg?react'
import { useBlockScroll } from '../scripts/function'
import { moderationApi } from '../services/moderation'
import { useState } from 'react'

interface BanUserFormProps {
  userId: string
  nickname: string
  onClose: () => void
  onSuccess?: () => void
}

const Form = ({ userId, nickname, onClose, onSuccess }: BanUserFormProps) => {
  const [reason, setReason] = useState('')
  const [isBanning, setIsBanning] = useState(false)

  const handleBan = async () => {
    if (!reason.trim()) return
    try {
      setIsBanning(true)
      await moderationApi.banUser(userId, reason.trim())
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Ошибка блокировки пользователя:', error)
    } finally {
      setIsBanning(false)
    }
  }

  return (
    <div className='form-container'>
      <div className='form-header-container red'>
        <ImportantWarningIcon className='form-header-ico' />
        <p className='form-header-text'>Блокировка пользователя</p>
        <button className='form-header-close-button red' onClick={onClose}>
          <RejectIcon className='form-header-ico' />
        </button>
      </div>

      <div className='form-content-container'>
        <div className='form-info-container'>
          <p className='form-info-text'>
            <span className='form-info-text-title'>
              Заблокировать пользователя @{nickname}?
            </span>
            <br /><br />
            <span className='form-info-text-description'>
              Аккаунт не будет удалён из системы — данные сохранятся, но доступ к платформе будет ограничен.
            </span>
          </p>
        </div>

        <div className='form-field-container'>
          <p className='form-field-text'>Причина блокировки</p>
          <textarea
            className='form-field-input message red'
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder='Опишите причину — она будет показана пользователю'
          />
        </div>

        <div className='form-manage'>
          <button
            className='form-manage-button red'
            onClick={handleBan}
            disabled={isBanning || !reason.trim()}
          >
            Заблокировать
          </button>
          <button
            className='form-manage-button cancellation'
            onClick={onClose}
            disabled={isBanning}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BanUserForm({ userId, nickname, onClose, onSuccess }: BanUserFormProps) {
  useBlockScroll(true)
  return (
    <div className='dark-area-container' onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Form userId={userId} nickname={nickname} onClose={onClose} onSuccess={onSuccess} />
      </div>
    </div>
  )
}