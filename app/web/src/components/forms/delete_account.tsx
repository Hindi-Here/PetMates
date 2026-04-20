import './delete_account.scss'
import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import ImportantWarningIcon from '@icons/important_warning.svg?react'
import InfoIcon from '@icons/info_circle.svg?react'

import { useState, useEffect } from 'react';
import { useBlockScroll, ValidatorCfg, ValidatorRegexCleanerCfg, useChangeInput } from '../scripts/function';

const Form = ({ onClose }: any) => {
  const [step, setStep] = useState(1);

  const next = () => { if (step < 3) setStep(X => X + 1); };
  const back = () => { if (step > 1) setStep(X => X - 1); };

  const { data, handleChange, resetForm } = useChangeInput({
    name: '',
    confirmCode: ''
  },
  {
    name: ValidatorRegexCleanerCfg.username,
  });

  useEffect(() => { resetForm(); }, [step]);

  const isInvalid = validate(step, data);

  return (
    <div className='form-container'> 

        <div className='form-header-container red'>
            <ImportantWarningIcon className='form-header-ico'/>
            <p className='form-header-text'> Удаление аккаунта </p>
            <button className='form-header-close-button red' onClick={onClose}>
                <RejectIcon className='form-header-close-ico' />
            </button>
        </div>

        <div className='form-content-container'>
            <div className='form-steps-container'>
                <div className={`form-step-container ${step > 1 ? 'active' : ''}`}>
                    <p className='form-step-number'> 1 </p>
                </div>
                <div className={`form-step-container ${step > 2 ? 'active' : ''}`}>
                    <p className='form-step-number' id='middle'> 2 </p>
                </div>
                <div className={`form-step-container ${step > 3 ? 'active' : ''}`}>
                    <p className='form-step-number'> 3 </p>
                </div>
            </div>

            {step === 1 && (
            <div className='form-field-container'>
                <p className='form-field-text'> Введите ваше имя пользователя </p>
                <input className='form-field-input red' name='name' maxLength={50} value={data.name} onChange={handleChange}/>
                <div className="form-field-helper-container">
                    <InfoIcon className='form-field-helper-ico'/>
                    <p className="form-field-helper-text"> Это поможет убедиться, что вы удаляете именно свой аккаунт </p>
                </div>
            </div>
            )}

            {step === 2 && (
            <div className='form-field-container'>
                <p className='form-field-text'> Введите код подтверждения </p>
                <input className='form-field-input red' name='confirmCode' value={data.confirmCode} onChange={handleChange}/>
                <div className="form-field-helper-container">
                    <InfoIcon className='form-field-helper-ico'/>
                    <p className="form-field-helper-text"> Это подтвердит подлинность владения аккаунтом </p>
                </div>
            </div>
            )}

            {step === 3 && (
            <div className='form-info-container'>
                <p className='form-info-text'> <span className='form-info-text-title'> Вы действительно хотите удалить этот аккаунт? </span> <br/> <br/>
                    <span className='form-info-text-description'> Это действие необратимо. Ваша учетная запись, созданные проекты и личные данные будут удалены навсегда </span> </p>
            </div>
            )}

            <div className='form-manage'>
                <button className='form-manage-button red' onClick={next} disabled={isInvalid}> {step === 3 ? 'Удалить' : 'Далее'}  </button>
                {step > 1 && (
                    <button className='form-manage-button back' onClick={back}>
                        Назад
                    </button>
                )}
                <button className='form-manage-button cancellation'> Отмена </button>
            </div>
        </div>
    </div>
  )
}

const validate = (step: number, data: any): boolean => {
  switch (step) {
    case 1:
      return !ValidatorCfg.required(data.name);
    case 2:
      return !ValidatorCfg.required(data.confirmCode);
    case 3:
      return false;
    default:
      return false;
  }
};

export default function DeleteAccountForm({ onClose }: any) {
  useBlockScroll(true);
  return (
     <div className='dark-area-container' onClick={onClose}> 
        <div onClick={(e) => e.stopPropagation()}>
            <Form onClose={onClose}/>
        </div>
    </div>
  )
}