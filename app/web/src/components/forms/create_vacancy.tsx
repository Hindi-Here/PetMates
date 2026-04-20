import './create_vacancy.scss'
import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import InfoIcon from '@icons/info_circle.svg?react'
import VacancyAddIcon from '@icons/vacancy_add.svg?react'

import { useBlockScroll, useTagInput, ValidatorCfg, ValidatorRegexCleanerCfg, useChangeInput } from '../scripts/function';

const Form = ({ onClose }: any) => {
  const { handleInput, handleKeyDown } = useTagInput();
  const { data, handleChange } = useChangeInput({
      role: '',
      message: '',
      tags: ''
    },
    {
      role: ValidatorRegexCleanerCfg.role,
      message: ValidatorRegexCleanerCfg.message, 
      tags: ValidatorRegexCleanerCfg.tags
    });

  const fullRuleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInput(e);
    handleChange(e);  
  };
      
  const isInvalid = validate(data);
  return (
    <div className='form-container'> 

        <div className='form-header-container'>
            <VacancyAddIcon className='form-header-ico'/>
            <p className='form-header-text'> Создание заявки </p>
            <button className='form-header-close-button' onClick={onClose}>
                <RejectIcon className='form-header-close-ico' />
            </button>
        </div>

        <div className='form-content-container'>
            <div className='form-field-container'>
                <p className='form-field-text'> Должность / Роль </p>
                <input className='form-field-input' maxLength={50} name="role" value={data.role} onChange={handleChange}/>
                <div className="form-field-helper-container">
                    <InfoIcon className='form-field-helper-ico'/>
                    <p className="form-field-helper-text"> Укажите роль, чтобы участник понимал свои задачи (3-50 символов) </p>
                </div>
            </div>
            <div className='form-field-container'>
                <div className='form-field-text-wrapper'>
                    <p className='form-field-text'> Сообщение </p>
                    <p className={`char-counter ${data.message.length >= 500 ? 'limit' : ''}`}> {data.message.length} / 500 </p>
                </div>
                <textarea className='form-field-input message' name="message" value={data.message} onChange={handleChange} />
                <div className="form-field-helper-container">
                    <InfoIcon className='form-field-helper-ico'/>
                    <p className="form-field-helper-text"> Расскажите подробнее о роли и требованиях к участнику </p>
                </div>
            </div>
            <div className='form-field-container'>
                <p className='form-field-text'> Hard Skills </p>
                <textarea className='form-field-input tags' maxLength={250} name="tags" value={data.tags} onChange={fullRuleChange} onKeyDown={handleKeyDown}  placeholder="#database #open_source #Performance" rows={1}/>
                <div className="form-field-helper-container">
                    <InfoIcon className='form-field-helper-ico'/>
                    <p className="form-field-helper-text"> Укажите навыки, которыми должен обладать участник проекта </p>
                </div>
            </div>

            <div className='form-manage'>
                <button className='form-manage-button' disabled={isInvalid}> Создать </button>
                <button className='form-manage-button cancellation'> Отмена </button>
            </div>
        </div>
    </div>
  )
}

const validate = (data: any): boolean => {
  return !ValidatorCfg.required(data.role) || 
         !ValidatorCfg.minLength(data.role, 3) || 

         !ValidatorCfg.required(data.message) ||
         !ValidatorCfg.maxLength(data.message, 500) ||
         
         !ValidatorCfg.required(data.tags) ||
         !ValidatorCfg.hasTag(data.tags)
};

export default function CreateVacancyForm({ onClose }: any) {
  useBlockScroll(true); 
  return (
     <div className='dark-area-container' onClick={onClose}> 
        <div onClick={(e) => e.stopPropagation()}>
            <Form onClose={onClose}/>
        </div>
    </div>
  )
}