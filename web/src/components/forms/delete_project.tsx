import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import ImportantWarningIcon from '@icons/important_warning.svg?react'
import { useBlockScroll } from '../scripts/function'
import { projectsApi } from '../services/project'
import { useState } from 'react'

interface DeleteProjectFormProps {
  projectId: string
  onClose: () => void
  onSuccess?: () => void
}

const Form = ({ projectId, onClose, onSuccess }: DeleteProjectFormProps) => {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await projectsApi.deleteProject(projectId)
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Ошибка удаления проекта:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className='form-container'> 
      <div className='form-header-container red'>
        <ImportantWarningIcon className='form-header-ico'/>
        <p className='form-header-text'> Удаление проекта </p>
        <button className='form-header-close-button red' onClick={onClose}>
          <RejectIcon className='form-header-ico' />
        </button>
      </div>

      <div className='form-content-container'>
        <div className='form-info-container'>
          <p className='form-info-text'> 
            <span className='form-info-text-title'> 
              Вы действительно хотите удалить этот проект? 
            </span> 
            <br/> <br/>
            <span className='form-info-text-description'> 
              Это действие нельзя будет отменить, а все связанные данные будут безвозвратно удалены. 
            </span> 
          </p>
        </div>

        <div className='form-manage'>
          <button 
            className='form-manage-button red' 
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Удаление...' : 'Удалить'}
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

export default function DeleteProjectForm({ projectId, onClose, onSuccess }: DeleteProjectFormProps) {
  useBlockScroll(true);
  return (
     <div className='dark-area-container' onClick={onClose}> 
        <div onClick={(e) => e.stopPropagation()}>
            <Form projectId={projectId} onClose={onClose} onSuccess={onSuccess}/>
        </div>
    </div>
  )
}