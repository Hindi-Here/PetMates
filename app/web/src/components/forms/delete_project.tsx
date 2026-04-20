import './delete_project.scss'
import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import ImportantWarningIcon from '@icons/important_warning.svg?react'

import { useBlockScroll } from '../scripts/function';

const Form = ({ onClose }: any) => {
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
                <p className='form-info-text'> <span className='form-info-text-title'> Вы действительно хотите удалить этот проект? </span> <br/> <br/>
                    <span className='form-info-text-description'> Это действие нельзя будет отменить, а все связанные данные будут безвозвратно удалены. </span> </p>
            </div>

            <div className='form-manage'>
                <button className='form-manage-button red'> Удалить </button>
                <button className='form-manage-button cancellation'> Отмена </button>
            </div>
        </div>
    </div>
  )
}

export default function DeleteProjectForm({ onClose }: any) {
  useBlockScroll(true);
  return (
     <div className='dark-area-container' onClick={onClose}> 
        <div onClick={(e) => e.stopPropagation()}>
            <Form onClose={onClose}/>
        </div>
    </div>
  )
}