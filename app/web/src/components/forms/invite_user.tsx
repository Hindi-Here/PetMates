import './invite_user.scss'
import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import InfoIcon from '@icons/info_circle.svg?react'
import InviteInProjectIcon from '@icons/invite_in_project.svg?react'

import { useBlockScroll, ValidatorCfg, ValidatorRegexCleanerCfg, useChangeInput } from '../scripts/function';

const Form = ({ onClose }: any) => {
  const { data, handleChange } = useChangeInput({
    role: '',
    message: ''
  },
  {
    role: ValidatorRegexCleanerCfg.role,
  });
    
  const isInvalid = validate(data);

  return (
    <div className='form-container'> 

        <div className='form-header-container'>
            <InviteInProjectIcon className='form-header-ico'/>
            <p className='form-header-text'> Приглашение участника </p>
            <button className='form-header-close-button' onClick={onClose}>
                <RejectIcon className='form-header-close-ico' />
            </button>
        </div>

        <div className='form-content-container'>
            <div className='form-field-container'>
                <p className='form-field-text'> Выберите проект </p>
                {/* render project from user info */}
            </div>
            <div className='form-field-container'>
                <p className='form-field-text'> Должность / Роль </p>
                <input className='form-field-input' name='role' maxLength={50} value={data.role} onChange={handleChange}/>
                <div className="form-field-helper-container">
                    <InfoIcon className='form-field-helper-ico'/>
                    <p className="form-field-helper-text"> Укажите роль, чтобы участник понимал свои задачи (3-50 символов) </p>
                </div>
            </div>
            <div className='form-field-container'>
                <div className='form-field-text-wrapper'>
                    <p className='form-field-text no-required'> Сообщение </p>
                    <p className={`char-counter ${data.message.length >= 500 ? 'limit' : ''}`}> {data.message.length} / 500 </p>
                </div>
                <textarea className='form-field-input message' name="message" value={data.message} onChange={handleChange} />
                <div className="form-field-helper-container">
                    <InfoIcon className='form-field-helper-ico'/>
                    <p className="form-field-helper-text"> Расскажите подробнее о проекте или почему вы хотите пригласить этого участника </p>
                </div>
            </div>

            <div className='form-manage'>
                <button className='form-manage-button' disabled={isInvalid}> Пригласить </button>
                <button className='form-manage-button cancellation'> Отмена </button>
            </div>
        </div>
    </div>
  )
}

const validate = (data: any): boolean => {
  return !ValidatorCfg.required(data.role) ||
         !ValidatorCfg.minLength(data.role, 3) ||      
         !ValidatorCfg.maxLength(data.message, 500)
};

export default function InviteUserForm({ onClose }: any) {
  useBlockScroll(true);
  return (
     <div className='dark-area-container' onClick={onClose}> 
        <div onClick={(e) => e.stopPropagation()}>
            <Form onClose={onClose}/>
        </div>
    </div>
  )
}