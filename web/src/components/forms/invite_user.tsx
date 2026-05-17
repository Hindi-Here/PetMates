import './invite_user.scss'
import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import InfoIcon from '@icons/info_circle.svg?react'
import InviteInProjectIcon from '@icons/invite_in_project.svg?react'

import { useBlockScroll, useChangeInput, validatorFormat, validatorRegex  } from '../scripts/function';

const Form = ({ onClose }: any) => {

  // validatelevel 2
  const { data, touched, dirty, handleChange, handleBlur } = useChangeInput({
    role: '',
    message: ''
  },
  {
    role: validatorRegex.role,
    message: validatorRegex.message,
  });
    
  // validate level 1
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
                <input className={`form-field-input ${touched.role && dirty.role && checkFormat('role', data.role) ? 'input-error' : ''}`}
                    name="role"  
                    value={data.role}      
                    onChange={handleChange} 
                    onBlur={handleBlur} 
                    maxLength={50}
                />
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
                <textarea className={`form-field-input message ${touched.message && dirty.message && checkFormat('message', data.message) ? 'input-error' : ''}`}
                    name="message"  
                    value={data.message}      
                    onChange={handleChange} 
                    onBlur={handleBlur} 
                />
                <div className="form-field-helper-container">
                    <InfoIcon className='form-field-helper-ico'/>
                    <p className="form-field-helper-text"> Расскажите подробнее о проекте или почему вы хотите пригласить этого участника </p>
                </div>
            </div>

            <div className='form-manage'>
                <button className='form-manage-button' disabled={isInvalid}> Пригласить </button>
                <button className='form-manage-button cancellation' onClick={onClose}>
                    Отмена
                </button>
            </div>
        </div>
    </div>
  )
}

// level 1 (for format field rules)
const checkFormat = (fieldName: string, value: string): string | null => {
    const rules: Record<string, Array<[boolean, string]>> = {
      role: [
        [!validatorFormat.required(value), 'Введите роль'],
        [!validatorFormat.minLength(value, 3), 'Минимум 3 символа'],
        [!validatorFormat.maxLength(value, 50), 'Максимум 50 символов']
      ],
      message: [
        [!validatorFormat.maxLength(value, 500), 'Максимум 500 символов']
      ]
    };

    const fieldRules = rules[fieldName];
    if (!fieldRules) return null;
    
    const error = fieldRules.find(([isInvalid]) => isInvalid);
    return error?.[1] ?? null;
  };

// level 1 (one rule for button form)
const validate = (data: any): boolean => {
  return !validatorFormat.required(data.role) ||
         !validatorFormat.minLength(data.role, 3) ||      
         !validatorFormat.maxLength(data.message, 500)
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