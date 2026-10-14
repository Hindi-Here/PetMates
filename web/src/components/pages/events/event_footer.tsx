import { Toggle } from '../../common/toggle'
import { useEventPreview } from './event_preview_context'

interface EventFooterProps {
  showActions?: boolean
  canSave?: boolean
  canCancel?: boolean
  isSaving?: boolean
  onSave?: () => void
  onCancel?: () => void
  onBack?: () => void
  saveError?: string | null
  onErrorEnd?: () => void
  saveSuccess?: boolean
  successText?: string
  onSuccessEnd?: () => void
}

// Компонент для отображения нижней части страницы мероприятия с действиями управления
export const EventFooter = ({
  showActions = true,
  canSave = false,
  canCancel = false,
  isSaving = false,
  onSave,
  onCancel,
  onBack,
  saveError = null,
  onErrorEnd,
  saveSuccess = false,
  successText = '',
  onSuccessEnd,
}: EventFooterProps) => {
  const { isPreview, setPreview } = useEventPreview()

  return (
    <>
      <div className='manage-container'>
        {showActions && (
          <>
            <button className='manage-button' onClick={onSave} disabled={!canSave || isSaving}>
              Сохранить
            </button>
            <button className='manage-button cancellation' onClick={onCancel} disabled={!canCancel || isSaving}>
              Отмена
            </button>
            <button className='manage-button cancellation' onClick={onBack} disabled={isSaving}>
              Назад
            </button>
          </>
        )}
        <div className='preview-group'>
          <p className='preview-label'>Предпросмотр</p>
          <Toggle checked={isPreview} onChange={setPreview} />
        </div>
      </div>

      {saveError && <p className='save-error-text message-auto-hide' onAnimationEnd={onErrorEnd}>{saveError}</p>}
      {saveSuccess && <p className='save-success-text message-auto-hide' onAnimationEnd={onSuccessEnd}>{successText}</p>}
    </>
  )
}